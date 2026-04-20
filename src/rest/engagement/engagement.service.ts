import { Injectable } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { EngagementType } from '@/generated/prisma/enums';

@Injectable()
export class EngagementService {
  private readonly prisma = prisma;

  async trackEvent(params: {
    userId: string;
    type: EngagementType;
    targetUserId?: string;
    teamId?: string;
    chatId?: string;
    metadata?: Record<string, any>;
  }) {
    return this.prisma.engagementEvent.create({
      data: params,
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
