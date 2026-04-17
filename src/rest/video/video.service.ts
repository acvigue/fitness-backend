import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import { UserService } from '@/rest/user/user.service';
import { AchievementService } from '@/rest/achievement/achievement.service';
import type { VideoCreateDto } from './dto/video-create.dto';
import type { VideoResponseDto } from './dto/video-response.dto';
import type { VideoUpdateDto } from './dto/video-update.dto';

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

  async findAll(): Promise<VideoResponseDto[]> {
    const videos = await prisma.video.findMany({
      orderBy: { name: 'asc' },
    });

    return videos.map((video) => this.toResponse(video));
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

  // ─── Helpers ───────────────────────────────────────────

  private toResponse(video: {
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
}
