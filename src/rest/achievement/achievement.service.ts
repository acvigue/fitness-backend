import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { CreateAchievementDto } from './dto/create-achievement.dto';
import type { AchievementDto } from '~/rest/achievement/dto/achievement.dto';

@Injectable()
export class AchievementService {
  async create(dto: CreateAchievementDto, userId: string): Promise<CreateAchievementDto> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Reported user not found');
    }
    const result = await prisma.achievement.create({
      data: {
        userId: userId,
        title: dto.title,
        description: dto.description,
      },
    });
    return {
      title: result.title,
      description: result.description,
    };
  }
  async get(userId: string): Promise<AchievementDto[]> {
    const result = await prisma.achievement.findMany({
      where: { userId: userId },
    });
    return result.map((r) => ({
      title: r.title,
      description: r.description,
      earnedAt: r.earnedAt.toString(),
    }));
  }
}
