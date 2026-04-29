import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma } from '@/shared/utils';
import { AuditService } from '@/rest/audit/audit.service';
import { NotificationService } from '@/rest/notification/notification.service';
import type { RestrictionAction } from '@/generated/prisma/enums';
import type {
  BanUserDto,
  DeleteMessageDto,
  FlagMessageDto,
  ListMessagesQueryDto,
  RestrictUserDto,
  SuspendUserDto,
  UnrestrictUserDto,
} from './dto/moderation.dto';
import type {
  DecideSuspensionAppealDto,
  SubmitSuspensionAppealDto,
  SuspensionAppealResponseDto,
} from './dto/suspension-appeal.dto';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService
  ) {}

  // ─── Auto-expiry cron ─────────────────────────────────────────────────
  // Suspensions and restrictions carry an `endsAt`. The OidcAuthGuard already
  // refuses access while `endsAt > now`, so expiry is implicit at the read
  // path; this cron makes the state explicit (sets `revokedAt`) so it shows
  // up correctly in account-status responses, audit trails, and notifications.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireOverdueEnforcements(): Promise<void> {
    try {
      await this.expireSuspensions();
      await this.expireRestrictions();
    } catch (err) {
      this.logger.error('Failed during expireOverdueEnforcements', err as Error);
    }
  }

  private async expireSuspensions(): Promise<void> {
    const now = new Date();
    const expiring = await prisma.userSuspension.findMany({
      where: { revokedAt: null, endsAt: { lte: now } },
      select: { id: true, userId: true },
    });
    if (expiring.length === 0) return;

    await prisma.userSuspension.updateMany({
      where: { id: { in: expiring.map((s) => s.id) } },
      data: { revokedAt: now },
    });

    for (const s of expiring) {
      await this.auditService
        .log({
          actorId: 'system',
          action: 'USER_SUSPENSION_EXPIRED',
          targetType: 'User',
          targetId: s.userId,
          metadata: { suspensionId: s.id },
        })
        .catch((err) => this.logger.warn('Failed to audit suspension expiry', err));
      await this.notificationService
        .create(
          s.userId,
          'ACCOUNT_UNSUSPENDED',
          'Account restored',
          'Your suspension has expired. Welcome back!'
        )
        .catch((err) => this.logger.warn('Failed to send unsuspension notification', err));
    }
  }

  private async expireRestrictions(): Promise<void> {
    const now = new Date();
    const result = await prisma.userRestriction.updateMany({
      where: { revokedAt: null, endsAt: { lte: now } },
      data: { revokedAt: now },
    });
    if (result.count > 0) {
      this.logger.log(`Auto-expired ${result.count} user restriction(s)`);
    }
  }

  async listInterTeamMessages(query: ListMessagesQueryDto) {
    const where: Record<string, unknown> = {
      chat: { type: 'TEAM' },
      deletedAt: null,
    };
    if (query.q) where.content = { contains: query.q, mode: 'insensitive' };
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.gte = new Date(query.from);
      if (query.to) createdAt.lte = new Date(query.to);
      where.createdAt = createdAt;
    }
    if (query.teamId) {
      where.chat = {
        type: 'TEAM',
        OR: [{ team1Id: query.teamId }, { team2Id: query.teamId }],
      };
    }
    return prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async flagMessage(messageId: string, dto: FlagMessageDto, managerId: string): Promise<void> {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');

    await prisma.message.update({
      where: { id: messageId },
      data: { hiddenAt: new Date(), hiddenById: managerId },
    });

    await this.auditService.log({
      actorId: managerId,
      action: 'MESSAGE_FLAGGED',
      targetType: 'Message',
      targetId: messageId,
      reason: dto.reason,
    });

    await this.notificationService.create(
      message.senderId,
      'MESSAGE_FLAGGED',
      'Your message was flagged',
      dto.reason
        ? `A department manager flagged your message: ${dto.reason}`
        : 'A department manager flagged your message for review.'
    );
  }

  async deleteMessage(messageId: string, dto: DeleteMessageDto, managerId: string): Promise<void> {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.deletedAt) throw new ForbiddenException('Message already deleted');

    await prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        deletedById: managerId,
        deletionReason: dto.reason,
      },
    });

    await this.auditService.log({
      actorId: managerId,
      action: 'MESSAGE_DELETED',
      targetType: 'Message',
      targetId: messageId,
      reason: dto.reason,
    });

    await this.notificationService.create(
      message.senderId,
      'MESSAGE_DELETED',
      'Your message was removed',
      `A department manager removed your message: ${dto.reason}`
    );
  }

  async suspendUser(targetUserId: string, dto: SuspendUserDto, managerId: string) {
    const endsAt = new Date(Date.now() + dto.durationHours * 60 * 60 * 1000);
    const suspension = await prisma.userSuspension.create({
      data: {
        userId: targetUserId,
        issuedById: managerId,
        reason: dto.reason,
        endsAt,
      },
    });

    await this.auditService.log({
      actorId: managerId,
      action: 'USER_SUSPENDED',
      targetType: 'User',
      targetId: targetUserId,
      reason: dto.reason,
      metadata: { durationHours: dto.durationHours },
    });

    await this.notificationService.create(
      targetUserId,
      'ACCOUNT_SUSPENDED',
      'Account suspended',
      `Your account has been suspended until ${endsAt.toISOString()}: ${dto.reason}`
    );

    return suspension;
  }

  async unsuspendUser(targetUserId: string, managerId: string): Promise<void> {
    const active = await prisma.userSuspension.findFirst({
      where: { userId: targetUserId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!active) throw new NotFoundException('No active suspension');

    await prisma.userSuspension.update({
      where: { id: active.id },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      actorId: managerId,
      action: 'USER_UNSUSPENDED',
      targetType: 'User',
      targetId: targetUserId,
    });

    await this.notificationService.create(
      targetUserId,
      'ACCOUNT_UNSUSPENDED',
      'Account restored',
      'Your suspension has been lifted. Welcome back!'
    );
  }

  async banUser(targetUserId: string, dto: BanUserDto, managerId: string) {
    const ban = await prisma.userBan.create({
      data: { userId: targetUserId, issuedById: managerId, reason: dto.reason },
    });
    await this.auditService.log({
      actorId: managerId,
      action: 'USER_BANNED',
      targetType: 'User',
      targetId: targetUserId,
      reason: dto.reason,
    });
    await this.notificationService.create(
      targetUserId,
      'ACCOUNT_BANNED',
      'Account banned',
      `Your account has been permanently banned: ${dto.reason}`
    );
    return ban;
  }

  async unbanUser(targetUserId: string, managerId: string): Promise<void> {
    const active = await prisma.userBan.findFirst({
      where: { userId: targetUserId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!active) throw new NotFoundException('No active ban');
    await prisma.userBan.update({ where: { id: active.id }, data: { revokedAt: new Date() } });
    await this.auditService.log({
      actorId: managerId,
      action: 'USER_UNBANNED',
      targetType: 'User',
      targetId: targetUserId,
    });
  }

  async restrictUser(targetUserId: string, dto: RestrictUserDto, managerId: string) {
    const endsAt = new Date(Date.now() + dto.durationHours * 60 * 60 * 1000);
    const restrictions = await Promise.all(
      dto.actions.map((action) =>
        prisma.userRestriction.create({
          data: {
            userId: targetUserId,
            issuedById: managerId,
            action: action as RestrictionAction,
            reason: dto.reason,
            endsAt,
          },
        })
      )
    );
    await this.auditService.log({
      actorId: managerId,
      action: 'USER_RESTRICTED',
      targetType: 'User',
      targetId: targetUserId,
      reason: dto.reason,
      metadata: { actions: dto.actions, durationHours: dto.durationHours },
    });
    await this.notificationService.create(
      targetUserId,
      'ACCOUNT_RESTRICTED',
      'Account actions restricted',
      `The following actions are restricted for ${dto.durationHours} hours: ${dto.actions.join(', ')}. Reason: ${dto.reason}`
    );
    return restrictions;
  }

  async unrestrictUser(
    targetUserId: string,
    dto: UnrestrictUserDto,
    managerId: string
  ): Promise<void> {
    await prisma.userRestriction.updateMany({
      where: {
        userId: targetUserId,
        action: { in: dto.actions as RestrictionAction[] },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await this.auditService.log({
      actorId: managerId,
      action: 'USER_UNRESTRICTED',
      targetType: 'User',
      targetId: targetUserId,
      metadata: { actions: dto.actions },
    });
  }

  async assertAllowed(userId: string, action: RestrictionAction): Promise<void> {
    const active = await prisma.userRestriction.findFirst({
      where: {
        userId,
        action,
        revokedAt: null,
        endsAt: { gt: new Date() },
      },
      select: { id: true, reason: true },
    });
    if (active) {
      throw new ForbiddenException(`Action ${action} is restricted: ${active.reason}`);
    }
  }

  // ─── Suspension appeals ───────────────────────────────────────────────

  async submitSuspensionAppeal(
    userId: string,
    dto: SubmitSuspensionAppealDto
  ): Promise<SuspensionAppealResponseDto> {
    // The latest active suspension is the one being appealed.
    const active = await prisma.userSuspension.findFirst({
      where: { userId, revokedAt: null, endsAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!active) {
      throw new BadRequestException('No active suspension to appeal');
    }

    const existing = await prisma.suspensionAppeal.findFirst({
      where: { suspensionId: active.id, userId, status: 'PENDING' },
    });
    if (existing) {
      throw new BadRequestException('You already have a pending appeal for this suspension');
    }

    const appeal = await prisma.suspensionAppeal.create({
      data: {
        suspensionId: active.id,
        userId,
        message: dto.message,
      },
    });

    await this.auditService
      .log({
        actorId: userId,
        action: 'SUSPENSION_APPEAL_SUBMITTED',
        targetType: 'UserSuspension',
        targetId: active.id,
        metadata: { appealId: appeal.id },
      })
      .catch((err) => this.logger.warn('Failed to audit appeal submission', err));

    return this.toAppealResponse(appeal);
  }

  async listMyAppeals(userId: string): Promise<SuspensionAppealResponseDto[]> {
    const appeals = await prisma.suspensionAppeal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return appeals.map((a) => this.toAppealResponse(a));
  }

  async listPendingAppeals(): Promise<SuspensionAppealResponseDto[]> {
    const appeals = await prisma.suspensionAppeal.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    if (appeals.length === 0) return [];
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(appeals.map((a) => a.userId))] } },
      select: { id: true, name: true, username: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return appeals.map((a) =>
      this.toAppealResponse(a, byId.get(a.userId) ?? null)
    );
  }

  async decideSuspensionAppeal(
    appealId: string,
    dto: DecideSuspensionAppealDto,
    managerId: string
  ): Promise<SuspensionAppealResponseDto> {
    const appeal = await prisma.suspensionAppeal.findUnique({
      where: { id: appealId },
      include: { suspension: { select: { id: true, userId: true, revokedAt: true } } },
    });
    if (!appeal) throw new NotFoundException('Appeal not found');
    if (appeal.status !== 'PENDING') {
      throw new BadRequestException('Appeal is no longer pending');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedAppeal = await tx.suspensionAppeal.update({
        where: { id: appealId },
        data: { status: dto.decision },
      });
      if (dto.decision === 'APPROVED' && !appeal.suspension.revokedAt) {
        await tx.userSuspension.update({
          where: { id: appeal.suspension.id },
          data: { revokedAt: new Date() },
        });
      }
      return updatedAppeal;
    });

    await this.auditService
      .log({
        actorId: managerId,
        action:
          dto.decision === 'APPROVED' ? 'SUSPENSION_APPEAL_APPROVED' : 'SUSPENSION_APPEAL_DENIED',
        targetType: 'SuspensionAppeal',
        targetId: appealId,
        reason: dto.reason,
        metadata: { suspensionId: appeal.suspension.id, userId: appeal.userId },
      })
      .catch((err) => this.logger.warn('Failed to audit appeal decision', err));

    await this.notificationService
      .create(
        appeal.userId,
        'SUSPENSION_APPEAL_DECIDED',
        dto.decision === 'APPROVED' ? 'Appeal approved' : 'Appeal denied',
        dto.decision === 'APPROVED'
          ? 'Your suspension appeal was approved. Your account is restored.'
          : `Your suspension appeal was denied.${dto.reason ? ` Reason: ${dto.reason}` : ''}`,
        { appealId, decision: dto.decision }
      )
      .catch((err) => this.logger.warn('Failed to send appeal decision notification', err));

    return this.toAppealResponse(updated);
  }

  private toAppealResponse(
    a: {
      id: string;
      suspensionId: string;
      userId: string;
      message: string;
      status: 'PENDING' | 'APPROVED' | 'DENIED';
      createdAt: Date;
    },
    user?: { name: string | null; username: string | null } | null
  ): SuspensionAppealResponseDto {
    return {
      id: a.id,
      suspensionId: a.suspensionId,
      userId: a.userId,
      userName: user?.name ?? null,
      userUsername: user?.username ?? null,
      message: a.message,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
