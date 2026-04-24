import { ForbiddenException, Injectable } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { EngagementType } from '@/generated/prisma/enums';
import type { Prisma } from '@/generated/prisma/client';

// Event types that are inherently cumulative — each occurrence is a distinct data point.
const COUNTABLE_EVENT_TYPES = new Set<EngagementType>([EngagementType.MESSAGE_SENT]);

@Injectable()
export class EngagementService {
  private readonly prisma = prisma;

  async trackEvent(
    params: {
      userId: string;
      type: EngagementType;
      targetUserId?: string;
      teamId?: string;
      chatId?: string;
      metadata?: Record<string, unknown>;
    },
    authenticatedUserId: string
  ) {
    if (params.userId !== authenticatedUserId) {
      throw new ForbiddenException('Cannot record engagement on behalf of another user');
    }

    if (!COUNTABLE_EVENT_TYPES.has(params.type)) {
      const existing = await this.prisma.engagementEvent.findFirst({
        where: {
          userId: params.userId,
          type: params.type,
          targetUserId: params.targetUserId ?? null,
          teamId: params.teamId ?? null,
          chatId: params.chatId ?? null,
        },
      });
      if (existing) {
        return existing;
      }
    }

    return this.prisma.engagementEvent.create({
      data: {
        ...params,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async getUserEngagement(userId: string) {
    return this.prisma.engagementEvent.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getProfileViews(userId: string) {
    return this.prisma.engagementEvent.count({
      where: {
        targetUserId: userId,
        type: EngagementType.PROFILE_VIEW,
      },
    });
  }

  async getMessagesSent(userId: string) {
    return this.prisma.engagementEvent.count({
      where: {
        userId,
        type: EngagementType.MESSAGE_SENT,
      },
    });
  }
}
