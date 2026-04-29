import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import { UserService } from '@/rest/user/user.service';
import { AchievementService } from '@/rest/achievement/achievement.service';
import type { VideoCreateDto } from './dto/video-create.dto';
import {
  VideoCreateResponseDto,
  VideoResponseDto,
  type VideoStatusValue,
} from './dto/video-response.dto';
import type { VideoUpdateDto } from './dto/video-update.dto';
import type { UpdateVideoProgressDto, VideoProgressResponseDto } from './dto/video-progress.dto';
import type { PaginationParams } from '@/rest/common/pagination';
import { paginate, type PaginatedResult } from '@/rest/common/pagination';
import { MuxService } from './mux.service';

type VideoRow = Prisma.VideoGetPayload<object>;

function toResponse(video: VideoRow): VideoResponseDto {
  const playbackId = video.muxPlaybackId;
  return {
    id: video.id,
    name: video.name,
    description: video.description,
    uploaderId: video.uploaderId,
    sportId: video.sportId,
    status: video.status as VideoStatusValue,
    playbackUrl: playbackId ? MuxService.playbackUrl(playbackId) : null,
    thumbnailUrl: playbackId ? MuxService.thumbnailUrl(playbackId) : null,
    durationSec: video.durationSec,
    aspectRatio: video.aspectRatio,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  };
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly achievementService: AchievementService,
    private readonly mux: MuxService
  ) {}

  async create(dto: VideoCreateDto, userId: string): Promise<VideoCreateResponseDto> {
    const upload = await this.mux.createDirectUpload();

    const video = await prisma.video.create({
      data: {
        name: dto.name,
        description: dto.description,
        uploaderId: userId,
        sportId: dto.sportId,
        muxUploadId: upload.uploadId,
        status: 'PENDING',
      },
    });

    return { video: toResponse(video), uploadUrl: upload.uploadUrl };
  }

  async findAll(
    pagination: PaginationParams,
    filters?: { sportId?: string }
  ): Promise<PaginatedResult<VideoResponseDto>> {
    const where: Prisma.VideoWhereInput = {};
    if (filters?.sportId) where.sportId = filters.sportId;

    return paginate(
      pagination,
      () => prisma.video.count({ where }),
      ({ skip, take }) =>
        prisma.video
          .findMany({ where, skip, take, orderBy: { updatedAt: 'desc' } })
          .then((videos) => videos.map(toResponse))
    );
  }

  async findOne(id: string): Promise<VideoResponseDto> {
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video not found');
    return toResponse(video);
  }

  async update(id: string, dto: VideoUpdateDto, userId: string): Promise<VideoResponseDto> {
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video not found');
    if (video.uploaderId !== userId) {
      throw new ForbiddenException('You are not the video uploader');
    }

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        sportId: dto.sportId,
      },
    });

    return toResponse(updatedVideo);
  }

  async delete(id: string, userId: string): Promise<void> {
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video not found');
    if (video.uploaderId !== userId) {
      throw new ForbiddenException('You are not the video uploader');
    }

    if (video.muxAssetId) {
      await this.mux.deleteAsset(video.muxAssetId);
    }

    await prisma.video.delete({ where: { id } });
  }

  async updateProgress(
    videoId: string,
    userId: string,
    dto: UpdateVideoProgressDto
  ): Promise<VideoProgressResponseDto> {
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');

    const record = await prisma.videoProgress.upsert({
      where: { userId_videoId: { userId, videoId } },
      create: {
        userId,
        videoId,
        positionSeconds: dto.positionSeconds,
        completed: dto.completed ?? false,
      },
      update: {
        positionSeconds: dto.positionSeconds,
        completed: dto.completed ?? undefined,
      },
    });

    return {
      videoId: record.videoId,
      positionSeconds: record.positionSeconds,
      completed: record.completed,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async getProgress(videoId: string, userId: string): Promise<VideoProgressResponseDto> {
    const record = await prisma.videoProgress.findUnique({
      where: { userId_videoId: { userId, videoId } },
    });

    if (!record) {
      return {
        videoId,
        positionSeconds: 0,
        completed: false,
        updatedAt: new Date(0).toISOString(),
      };
    }

    return {
      videoId: record.videoId,
      positionSeconds: record.positionSeconds,
      completed: record.completed,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  // --- Mux webhook handlers (called by MuxWebhookController) -----------------

  async onAssetCreated(uploadId: string, assetId: string): Promise<void> {
    const result = await prisma.video.updateMany({
      where: { muxUploadId: uploadId, muxAssetId: null },
      data: { muxAssetId: assetId, status: 'PROCESSING' },
    });
    if (result.count === 0) {
      this.logger.warn(`onAssetCreated: no PENDING video found for uploadId=${uploadId}`);
    }
  }

  async onAssetReady(
    assetId: string,
    info: { playbackId: string; durationSec: number | null; aspectRatio: string | null }
  ): Promise<void> {
    const result = await prisma.video.updateMany({
      where: { muxAssetId: assetId },
      data: {
        muxPlaybackId: info.playbackId,
        durationSec: info.durationSec,
        aspectRatio: info.aspectRatio,
        status: 'READY',
      },
    });
    if (result.count === 0) {
      this.logger.warn(`onAssetReady: no video found for assetId=${assetId}`);
    }
  }

  async onAssetErrored(assetId: string): Promise<void> {
    await prisma.video.updateMany({
      where: { muxAssetId: assetId },
      data: { status: 'ERRORED' },
    });
  }

  async onUploadFailed(uploadId: string): Promise<void> {
    await prisma.video.updateMany({
      where: { muxUploadId: uploadId, muxAssetId: null },
      data: { status: 'ERRORED' },
    });
  }
}
