import { Injectable } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import type { CreateAchievementDefinitionDto } from './dto/create-achievement-definition.dto';
import type { AchievementDefinitionResponseDto } from './dto/achievement-definition-response.dto';
import type { UserAchievementResponseDto } from './dto/user-achievement-response.dto';

const USER_ACHIEVEMENT_INCLUDE = {
  achievement: true,
} as const;

@Injectable()
export class AchievementService {
  constructor(private readonly notificationService: NotificationService) {}

  async createDefinition(
    dto: CreateAchievementDefinitionDto
  ): Promise<AchievementDefinitionResponseDto> {
    const definition = await prisma.achievementDefinition.create({
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon ?? null,
        criteriaType: dto.criteriaType,
        threshold: dto.threshold,
      },
    });

    return this.toDefinitionResponse(definition);
  }

  async listDefinitions(): Promise<AchievementDefinitionResponseDto[]> {
    const definitions = await prisma.achievementDefinition.findMany({
      orderBy: { name: 'asc' },
    });

    return definitions.map((d) => this.toDefinitionResponse(d));
  }

  async getUserAchievements(userId: string): Promise<UserAchievementResponseDto[]> {
    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: USER_ACHIEVEMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return achievements.map((a) => this.toUserAchievementResponse(a));
  }

  async getAllAchievementsForUser(userId: string): Promise<UserAchievementResponseDto[]> {
    const definitions = await prisma.achievementDefinition.findMany({
      orderBy: { name: 'asc' },
    });

    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: USER_ACHIEVEMENT_INCLUDE,
    });

    const userMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua]));

    return definitions.map((def) => {
      const ua = userMap.get(def.id);
      return {
        id: ua?.id ?? '',
        progress: ua?.progress ?? 0,
        unlockedAt: ua?.unlockedAt?.toISOString() ?? null,
        achievement: this.toDefinitionResponse(def),
      };
    });
  }

  async getLockedAchievements(userId: string): Promise<UserAchievementResponseDto[]> {
    const definitions = await prisma.achievementDefinition.findMany({
      orderBy: { name: 'asc' },
    });

    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: USER_ACHIEVEMENT_INCLUDE,
    });

    const userMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua]));

    return definitions
      .filter((def) => {
        const ua = userMap.get(def.id);
        return !ua?.unlockedAt;
      })
      .map((def) => {
        const ua = userMap.get(def.id);
        return {
          id: ua?.id ?? '',
          progress: ua?.progress ?? 0,
          unlockedAt: null,
          achievement: this.toDefinitionResponse(def),
        };
      });
  }

  async incrementProgress(userId: string, criteriaType: string): Promise<void> {
    const definitions = await prisma.achievementDefinition.findMany({
      where: { criteriaType },
      orderBy: { threshold: 'asc' },
    });

    const unlocked: { name: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const definition of definitions) {
        const existing = await tx.userAchievement.findUnique({
          where: { userId_achievementId: { userId, achievementId: definition.id } },
        });

        if (existing?.unlockedAt) {
          continue;
        }

        const newProgress = (existing?.progress ?? 0) + 1;
        const isUnlocked = newProgress >= definition.threshold;

        await tx.userAchievement.upsert({
          where: { userId_achievementId: { userId, achievementId: definition.id } },
          create: {
            userId,
            achievementId: definition.id,
            progress: newProgress,
            unlockedAt: isUnlocked ? new Date() : null,
          },
          update: {
            progress: newProgress,
            unlockedAt: isUnlocked ? new Date() : null,
          },
        });

        if (isUnlocked) {
          unlocked.push({ name: definition.name });
        }
      }
    });

    for (const { name } of unlocked) {
      await this.notificationService.create(
        userId,
        'ACHIEVEMENT_UNLOCKED',
        'Achievement Unlocked!',
        `You earned the achievement "${name}"`
      );
    }
  }

  private toDefinitionResponse(definition: {
    id: string;
    name: string;
    description: string;
    icon: string | null;
    criteriaType: string;
    threshold: number;
  }): AchievementDefinitionResponseDto {
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      criteriaType: definition.criteriaType,
      threshold: definition.threshold,
    };
  }

  private toUserAchievementResponse(ua: {
    id: string;
    progress: number;
    unlockedAt: Date | null;
    achievement: {
      id: string;
      name: string;
      description: string;
      icon: string | null;
      criteriaType: string;
      threshold: number;
    };
  }): UserAchievementResponseDto {
    return {
      id: ua.id,
      progress: ua.progress,
      unlockedAt: ua.unlockedAt?.toISOString() ?? null,
      achievement: this.toDefinitionResponse(ua.achievement),
    };
  }
}
