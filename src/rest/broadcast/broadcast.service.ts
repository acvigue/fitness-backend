import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import type {
  BroadcastResponseDto,
  BroadcastStatsResponseDto,
  CreateBroadcastDto,
} from './dto/broadcast.dto';

@Injectable()
export class BroadcastService {
  constructor(private readonly notificationService: NotificationService) {}

  async broadcast(
    teamId: string,
    dto: CreateBroadcastDto,
    userId: string
  ): Promise<BroadcastResponseDto> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { users: { select: { id: true } } },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can send broadcasts');
    }

    const broadcast = await prisma.broadcast.create({
      data: { teamId, authorId: userId, content: dto.content },
    });

    if (team.users.length > 0) {
      await prisma.broadcastReceipt.createMany({
        data: team.users.map((u) => ({ broadcastId: broadcast.id, userId: u.id })),
        skipDuplicates: true,
      });
      await this.notificationService.createMany(
        team.users
          .filter((u) => u.id !== userId)
          .map((u) => ({
            userId: u.id,
            type: 'TEAM_BROADCAST',
            title: `${team.name} broadcast`,
            content: dto.content.slice(0, 180),
            metadata: { teamId, broadcastId: broadcast.id },
          }))
      );
    }

    return this.toResponse(broadcast);
  }

  async markRead(broadcastId: string, userId: string): Promise<void> {
    const receipt = await prisma.broadcastReceipt.findUnique({
      where: { broadcastId_userId: { broadcastId, userId } },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (receipt.readAt) return;
    await prisma.broadcastReceipt.update({
      where: { id: receipt.id },
      data: { readAt: new Date() },
    });
  }

  async getStats(broadcastId: string, userId: string): Promise<BroadcastStatsResponseDto> {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: { team: { select: { captainId: true } } },
    });
    if (!broadcast) throw new NotFoundException('Broadcast not found');
    if (broadcast.team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can view broadcast stats');
    }

    const [delivered, read] = await Promise.all([
      prisma.broadcastReceipt.count({ where: { broadcastId } }),
      prisma.broadcastReceipt.count({ where: { broadcastId, readAt: { not: null } } }),
    ]);

    return {
      broadcastId,
      delivered,
      read,
      total: delivered,
    };
  }

  async listForTeam(teamId: string, userId: string): Promise<BroadcastResponseDto[]> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { users: { select: { id: true } } },
    });
    if (!team) throw new NotFoundException('Team not found');

    const isMember = team.users.some((u) => u.id === userId);
    if (!isMember && team.captainId !== userId) {
      throw new ForbiddenException('Only team members can view broadcasts');
    }

    const broadcasts = await prisma.broadcast.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });
    return broadcasts.map((b) => this.toResponse(b));
  }

  private toResponse(b: {
    id: string;
    teamId: string;
    authorId: string;
    content: string;
    createdAt: Date;
  }): BroadcastResponseDto {
    return {
      id: b.id,
      teamId: b.teamId,
      authorId: b.authorId,
      content: b.content,
      createdAt: b.createdAt.toISOString(),
    };
  }
}
