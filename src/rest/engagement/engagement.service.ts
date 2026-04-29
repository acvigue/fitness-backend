import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { EngagementType } from '@/generated/prisma/enums';
import type { Prisma } from '@/generated/prisma/client';
import { AchievementService } from '@/rest/achievement/achievement.service';
import { paginate, type PaginationParams, type PaginatedResult } from '@/rest/common/pagination';
import type {
  EngagementCountResponseDto,
  EngagementEventResponseDto,
} from './dto/engagement-event-response.dto';

// Event types that are inherently cumulative — each occurrence is a distinct data point.
const COUNTABLE_EVENT_TYPES = new Set<EngagementType>([
  EngagementType.MESSAGE_SENT,
  EngagementType.PROFILE_VIEW,
  EngagementType.TEAM_CHAT_MESSAGE,
  EngagementType.MEETUP_ATTENDED,
  EngagementType.INTER_TEAM_INTERACTION,
]);

@Injectable()
export class EngagementService {
  private readonly prisma = prisma;
  private readonly logger = new Logger(EngagementService.name);

  constructor(private readonly achievementService: AchievementService) {}

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

    return this.recordEvent(params);
  }

  async recordEvent(params: {
    userId: string;
    type: EngagementType;
    targetUserId?: string;
    teamId?: string;
    chatId?: string;
    metadata?: Record<string, unknown>;
  }) {
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

    const event = await this.prisma.engagementEvent.create({
      data: {
        ...params,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    // Fire-and-forget achievement increment so callers aren't blocked on tier logic.
    this.achievementService
      .incrementProgress(params.userId, params.type)
      .catch((err) =>
        this.logger.warn(
          `Engagement event saved but achievement increment failed for ${params.userId}: ${err?.message ?? err}`
        )
      );

    return event;
  }

  async getUserEngagement(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<EngagementEventResponseDto>> {
    return paginate(
      pagination,
      () => this.prisma.engagementEvent.count({ where: { userId } }),
      ({ skip, take }) =>
        this.prisma.engagementEvent
          .findMany({
            where: { userId },
            skip,
            take,
            orderBy: { createdAt: 'desc' },
          })
          .then((events) =>
            events.map((e) => ({
              id: e.id,
              userId: e.userId,
              type: e.type,
              targetUserId: e.targetUserId,
              teamId: e.teamId,
              chatId: e.chatId,
              metadata: (e.metadata as Record<string, unknown> | null) ?? null,
              createdAt: e.createdAt,
            }))
          )
    );
  }

  async getProfileViews(userId: string): Promise<EngagementCountResponseDto> {
    const count = await this.prisma.engagementEvent.count({
      where: {
        targetUserId: userId,
        type: EngagementType.PROFILE_VIEW,
      },
    });
    return { count };
  }

  async getMessagesSent(userId: string): Promise<EngagementCountResponseDto> {
    const count = await this.prisma.engagementEvent.count({
      where: {
        userId,
        type: EngagementType.MESSAGE_SENT,
      },
    });
    return { count };
  }
}
