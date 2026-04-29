import { BadRequestException, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '@/rest/auth/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { MuxService } from './mux.service';
import { VideoService } from './video.service';

@ApiExcludeController()
@Controller({ path: 'mux/webhook', version: '1' })
export class MuxWebhookController {
  private readonly logger = new Logger(MuxWebhookController.name);

  constructor(
    private readonly mux: MuxService,
    private readonly videoService: VideoService
  ) {}

  @Public()
  @SkipThrottle()
  @Post()
  @HttpCode(200)
  async handle(@Req() req: RawBodyRequest<Request>): Promise<{ ok: true }> {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    let event;
    try {
      event = await this.mux.unwrapWebhook(rawBody, req.headers);
    } catch (err) {
      this.logger.warn(`Mux webhook signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'video.upload.asset_created': {
        const uploadId = event.data.id;
        const assetId = event.data.asset_id;
        if (uploadId && assetId) {
          await this.videoService.onAssetCreated(uploadId, assetId);
        }
        break;
      }
      case 'video.asset.ready': {
        const assetId = event.data.id;
        const playbackId = event.data.playback_ids?.[0]?.id ?? null;
        const durationSec = event.data.duration ?? null;
        const aspectRatio = event.data.aspect_ratio ?? null;
        if (assetId && playbackId) {
          await this.videoService.onAssetReady(assetId, {
            playbackId,
            durationSec,
            aspectRatio,
          });
        }
        break;
      }
      case 'video.asset.errored': {
        const assetId = event.data.id;
        if (assetId) {
          await this.videoService.onAssetErrored(assetId);
        }
        break;
      }
      case 'video.upload.errored':
      case 'video.upload.cancelled': {
        const uploadId = event.data.id;
        if (uploadId) {
          await this.videoService.onUploadFailed(uploadId);
        }
        break;
      }
      default:
        // Ignore everything else — live streams, robot jobs, master tracks, etc.
        break;
    }

    return { ok: true };
  }
}
