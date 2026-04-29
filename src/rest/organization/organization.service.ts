import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { UserService } from '@/rest/user/user.service';
import { AchievementService } from '@/rest/achievement/achievement.service';
import { AuditService } from '@/rest/audit/audit.service';
import { NotificationService } from '@/rest/notification/notification.service';
import type { PaginationParams } from '@/rest/common/pagination';
import { paginate, type PaginatedResult } from '@/rest/common/pagination';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
import type { OrganizationResponseDto } from './dto/organization-response.dto';
import type { OrganizationMemberResponseDto } from './dto/organization-member-response.dto';
import type { OrganizationMemberListItemDto } from './dto/organization-member-detail-response.dto';
import type { OrganizationMemberProfileResponseDto } from './dto/organization-member-detail-response.dto';
import type { OrganizationInvitationResponseDto } from './dto/organization-invitation-response.dto';
import type { OrganizationRole } from '@/generated/prisma/client';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly userService: UserService,
    private readonly achievementService: AchievementService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService
  ) {}
  async create(dto: CreateOrganizationDto, userId: string): Promise<OrganizationResponseDto> {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.name },
      });

      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: org.id,
          role: 'ADMIN',
        },
      });

      this.achievementService
        .incrementProgress(userId, 'ORGANIZATION_CREATE')
        .catch((err) =>
          this.logger.error(`Failed to award ORGANIZATION_CREATE achievement for ${userId}`, err)
        );

      return {
        id: org.id,
        name: org.name,
        memberCount: 1,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      };
    });
  }

  async findAll(pagination: PaginationParams): Promise<PaginatedResult<OrganizationResponseDto>> {
    return paginate(
      pagination,
      () => prisma.organization.count(),
      ({ skip, take }) =>
        prisma.organization
          .findMany({
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { members: true } } },
          })
          .then((orgs) =>
            orgs.map((org) => ({
              id: org.id,
              name: org.name,
              memberCount: org._count.members,
              createdAt: org.createdAt,
              updatedAt: org.updatedAt,
            }))
          )
    );
  }

  async findOne(id: string): Promise<OrganizationResponseDto> {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });

    if (!org) throw new NotFoundException('Organization not found');

    return {
      id: org.id,
      name: org.name,
      memberCount: org._count.members,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    userId: string
  ): Promise<OrganizationResponseDto> {
    await this.requireRole(id, userId, ['STAFF', 'ADMIN']);

    const org = await prisma.organization.update({
      where: { id },
      data: { ...(dto.name !== undefined && { name: dto.name }) },
      include: { _count: { select: { members: true } } },
    });

    return {
      id: org.id,
      name: org.name,
      memberCount: org._count.members,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.requireRole(id, userId, ['ADMIN']);

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    await prisma.organization.delete({ where: { id } });
  }

  async join(organizationId: string, userId: string): Promise<OrganizationMemberResponseDto> {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const existing = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (existing) throw new ConflictException('Already a member of this organization');

    const member = await prisma.organizationMember.create({
      data: { userId, organizationId, role: 'MEMBER' },
    });

    this.achievementService
      .incrementProgress(userId, 'ORGANIZATION_JOIN')
      .catch((err) =>
        this.logger.error(`Failed to award ORGANIZATION_JOIN achievement for ${userId}`, err)
      );

    return member;
  }

  async leave(organizationId: string, userId: string): Promise<void> {
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership) throw new NotFoundException('Not a member of this organization');

    await prisma.organizationMember.delete({ where: { id: membership.id } });
  }

  async getMembers(
    organizationId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<OrganizationMemberListItemDto>> {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const where = { organizationId };

    return paginate(
      pagination,
      () => prisma.organizationMember.count({ where }),
      ({ skip, take }) =>
        prisma.organizationMember
          .findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, username: true, name: true, email: true } } },
          })
          .then((members) =>
            members.map((m) => ({
              userId: m.user.id,
              username: m.user.username,
              name: m.user.name,
              email: m.user.email,
              role: m.role,
              joinedAt: m.createdAt.toISOString(),
            }))
          )
    );
  }

  async getMemberProfile(
    organizationId: string,
    userId: string
  ): Promise<OrganizationMemberProfileResponseDto> {
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: { select: { id: true, username: true, name: true, email: true } } },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    const profile = await this.userService.getProfile(userId);

    return {
      userId: membership.user.id,
      username: membership.user.username,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      joinedAt: membership.createdAt.toISOString(),
      profile,
    };
  }

  private async requireRole(
    organizationId: string,
    userId: string,
    allowedRoles: OrganizationRole[]
  ): Promise<void> {
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires one of: ${allowedRoles.join(', ')}. You have: ${membership.role}`
      );
    }
  }

  // ─── Role administration ────────────────────────────────

  async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    newRole: OrganizationRole,
    actorId: string
  ): Promise<OrganizationMemberListItemDto> {
    await this.requireRole(organizationId, actorId, ['ADMIN']);

    const target = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId } },
      include: { user: { select: { id: true, username: true, name: true, email: true } } },
    });
    if (!target) {
      throw new NotFoundException('User is not a member of this organization');
    }

    if (target.role === newRole) {
      return this.toMemberListItem(target);
    }

    // Last-admin guard: cannot demote the only ADMIN.
    if (target.role === 'ADMIN' && newRole !== 'ADMIN') {
      const adminCount = await prisma.organizationMember.count({
        where: { organizationId, role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last admin of the organization. Promote another member to ADMIN first.'
        );
      }
    }

    const updated = await prisma.organizationMember.update({
      where: { id: target.id },
      data: { role: newRole },
      include: { user: { select: { id: true, username: true, name: true, email: true } } },
    });

    this.auditService
      .log({
        actorId,
        action: 'ORGANIZATION_MEMBER_ROLE_CHANGED',
        targetType: 'organization_member',
        targetId: target.id,
        metadata: {
          organizationId,
          targetUserId,
          previousRole: target.role,
          newRole,
        },
      })
      .catch((err) => this.logger.warn('Failed to audit role change', err));

    this.notificationService
      .create(
        targetUserId,
        'ORGANIZATION_ROLE_CHANGED',
        'Organization role changed',
        `Your role has been changed to ${newRole}.`,
        { organizationId, previousRole: target.role, newRole }
      )
      .catch((err) => this.logger.warn('Failed to send role change notification', err));

    return this.toMemberListItem(updated);
  }

  async removeMember(organizationId: string, targetUserId: string, actorId: string): Promise<void> {
    await this.requireRole(organizationId, actorId, ['ADMIN']);

    const target = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId } },
    });
    if (!target) {
      throw new NotFoundException('User is not a member of this organization');
    }

    // Last-admin guard.
    if (target.role === 'ADMIN') {
      const adminCount = await prisma.organizationMember.count({
        where: { organizationId, role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last admin of the organization. Promote another member to ADMIN first.'
        );
      }
    }

    await prisma.organizationMember.delete({ where: { id: target.id } });

    this.auditService
      .log({
        actorId,
        action: 'ORGANIZATION_MEMBER_REMOVED',
        targetType: 'organization_member',
        targetId: target.id,
        metadata: { organizationId, targetUserId, removedRole: target.role },
      })
      .catch((err) => this.logger.warn('Failed to audit member removal', err));

    this.notificationService
      .create(
        targetUserId,
        'ORGANIZATION_MEMBER_REMOVED',
        'Removed from organization',
        'You have been removed from an organization.',
        { organizationId }
      )
      .catch((err) => this.logger.warn('Failed to send member-removed notification', err));
  }

  // ─── Invitations ────────────────────────────────────────

  async createInvitation(
    organizationId: string,
    invitedUserId: string,
    role: OrganizationRole,
    actorId: string
  ): Promise<OrganizationInvitationResponseDto> {
    await this.requireRole(organizationId, actorId, ['ADMIN']);

    if (invitedUserId === actorId) {
      throw new BadRequestException('You cannot invite yourself.');
    }

    const invitedUser = await prisma.user.findUnique({
      where: { id: invitedUserId },
      select: { id: true, username: true, name: true },
    });
    if (!invitedUser) {
      throw new NotFoundException('Invited user not found');
    }

    const existingMember = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: invitedUserId, organizationId } },
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this organization');
    }

    const existingPending = await prisma.organizationInvitation.findFirst({
      where: { organizationId, invitedUserId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException('A pending invitation already exists for this user');
    }

    const invitation = await prisma.organizationInvitation.create({
      data: {
        organizationId,
        invitedUserId,
        invitedById: actorId,
        role,
      },
    });

    this.auditService
      .log({
        actorId,
        action: 'ORGANIZATION_INVITATION_SENT',
        targetType: 'organization_invitation',
        targetId: invitation.id,
        metadata: { organizationId, invitedUserId, role },
      })
      .catch((err) => this.logger.warn('Failed to audit invitation', err));

    this.notificationService
      .create(
        invitedUserId,
        'ORGANIZATION_INVITE',
        'Organization invitation',
        `You have been invited to join an organization as ${role}.`,
        { organizationId, invitationId: invitation.id, role }
      )
      .catch((err) => this.logger.warn('Failed to send invitation notification', err));

    return this.toInvitationResponse(invitation, invitedUser);
  }

  async listInvitations(
    organizationId: string,
    actorId: string
  ): Promise<OrganizationInvitationResponseDto[]> {
    await this.requireRole(organizationId, actorId, ['STAFF', 'ADMIN']);

    const invitations = await prisma.organizationInvitation.findMany({
      where: { organizationId, status: 'PENDING' },
      include: {
        invitedUser: { select: { id: true, username: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((i) =>
      this.toInvitationResponse(i, i.invitedUser, i.organization?.name ?? null)
    );
  }

  async revokeInvitation(invitationId: string, actorId: string): Promise<void> {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation is no longer pending');
    }

    await this.requireRole(invitation.organizationId, actorId, ['ADMIN']);

    await prisma.organizationInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });

    this.auditService
      .log({
        actorId,
        action: 'ORGANIZATION_INVITATION_REVOKED',
        targetType: 'organization_invitation',
        targetId: invitationId,
        metadata: { organizationId: invitation.organizationId },
      })
      .catch((err) => this.logger.warn('Failed to audit revocation', err));
  }

  async listMyInvitations(userId: string): Promise<OrganizationInvitationResponseDto[]> {
    const invitations = await prisma.organizationInvitation.findMany({
      where: { invitedUserId: userId, status: 'PENDING' },
      include: {
        invitedUser: { select: { id: true, username: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((i) =>
      this.toInvitationResponse(i, i.invitedUser, i.organization?.name ?? null)
    );
  }

  async respondToInvitation(
    invitationId: string,
    userId: string,
    accept: boolean
  ): Promise<OrganizationInvitationResponseDto> {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
      include: {
        invitedUser: { select: { id: true, username: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.invitedUserId !== userId) {
      throw new ForbiddenException('Only the invited user can respond to this invitation');
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation is no longer pending');
    }

    const status = accept ? 'ACCEPTED' : 'DECLINED';

    const updated = await prisma.$transaction(async (tx) => {
      const updatedInv = await tx.organizationInvitation.update({
        where: { id: invitationId },
        data: { status },
      });
      if (accept) {
        await tx.organizationMember.create({
          data: {
            userId,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        });
      }
      return updatedInv;
    });

    this.auditService
      .log({
        actorId: userId,
        action: accept ? 'ORGANIZATION_INVITATION_ACCEPTED' : 'ORGANIZATION_INVITATION_DECLINED',
        targetType: 'organization_invitation',
        targetId: invitationId,
        metadata: { organizationId: invitation.organizationId, role: invitation.role },
      })
      .catch((err) => this.logger.warn('Failed to audit invitation response', err));

    this.notificationService
      .create(
        invitation.invitedById,
        'ORGANIZATION_INVITE_RESPONSE',
        accept ? 'Invitation accepted' : 'Invitation declined',
        accept
          ? 'A user accepted your organization invitation.'
          : 'A user declined your organization invitation.',
        { organizationId: invitation.organizationId, invitationId, accepted: accept }
      )
      .catch((err) => this.logger.warn('Failed to send invitation response notification', err));

    return this.toInvitationResponse(
      updated,
      invitation.invitedUser,
      invitation.organization?.name ?? null
    );
  }

  // ─── helpers ────────────────────────────────────────────

  private toMemberListItem(m: {
    user: { id: string; username: string | null; name: string | null; email: string | null };
    role: OrganizationRole;
    createdAt: Date;
  }): OrganizationMemberListItemDto {
    return {
      userId: m.user.id,
      username: m.user.username,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
    };
  }

  private toInvitationResponse(
    invitation: {
      id: string;
      organizationId: string;
      invitedUserId: string;
      invitedById: string;
      role: OrganizationRole;
      status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';
      createdAt: Date;
    },
    invitedUser?: { id: string; username: string | null; name: string | null } | null,
    organizationName?: string | null
  ): OrganizationInvitationResponseDto {
    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      organizationName: organizationName ?? null,
      invitedUserId: invitation.invitedUserId,
      invitedUserName: invitedUser?.name ?? null,
      invitedUserUsername: invitedUser?.username ?? null,
      invitedById: invitation.invitedById,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt.toISOString(),
    };
  }
}
