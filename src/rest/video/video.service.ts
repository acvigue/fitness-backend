import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import { UserService } from '@/rest/user/user.service';
import { AchievementService } from '@/rest/achievement/achievement.service';
import type { VideoCreateDto } from './dto/video-create.dto';
import type { VideoResponseDto, PaginatedVideoResponseDto } from './dto/video-response.dto';
import type { VideoUpdateDto } from './dto/video-update.dto';
import type { PaginationParams } from '@/rest/common/pagination';
import { paginate, type PaginatedResult } from '@/rest/common/pagination';

function toResponse(video: {
    id: string;
    name: string;
    description: string;
    uploaderId: string;
    sportId: string;
    url: string;
  }): VideoResponseDto {
    return {
      id: video.id,
      name: video.name,
      description: video.description,
      uploaderId: video.uploaderId,
      sportId: video.sportId,
      url: video.url,
    };
  }

@Injectable()
export class VideoService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly achievementService: AchievementService
  ) {}


  async create(dto: VideoCreateDto, userId: string): Promise<VideoResponseDto> {
    const video = await prisma.video.create({
      data: {
        name: dto.name,
        description: dto.description,
        uploaderId: userId,
        sportId: dto.sportId,
        url: dto.url,
      },
    });

    return this.toResponse(video);
  }
  
  async findAll(
    pagination: PaginationParams,
    filters?: {
      sportId?: string;
    }
  ): Promise<PaginatedResult<VideoResponseDto>> {
    const where: Record<string, unknown> = {};

    if (filters?.sportId) {
      where.sportId = filters.sportId;
    }

    return paginate(
      pagination,
      () => prisma.video.count({ where }),
      ({ skip, take }) =>
        prisma.video
          .findMany({
            where,
            skip,
            take,
            orderBy: { updatedAt: 'desc' },
          })
          .then((videos) => videos.map(toResponse))
    );
  }

  async findOne(id: string): Promise<VideoResponseDto> {
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return this.toResponse(video);
  }

  async update(id: string, dto: VideoUpdateDto, userId: string): Promise<VideoResponseDto> {
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.uploaderId !== userId) {
      throw new ForbiddenException('You are not the video uploader');
    }

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        sportId: dto.sportId,
        url: dto.url,
      },
    });

    return this.toResponse(updatedVideo);
  }

  async delete(id: string, userId: string) {
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.uploaderId !== userId) {
      throw new ForbiddenException('You are not the video uploader');
    }

    await prisma.video.delete({
      where: { id },
    });
  }

  
}
