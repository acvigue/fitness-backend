import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Mux from '@mux/mux-node';
import type { UnwrapWebhookEvent } from '@mux/mux-node/resources/webhooks/webhooks';
import type { IncomingHttpHeaders } from 'http';

export type MuxDirectUpload = {
  uploadId: string;
  uploadUrl: string;
};

export type MuxAssetSnapshot = {
  assetId: string;
  playbackId: string | null;
  status: 'preparing' | 'ready' | 'errored';
  durationSec: number | null;
  aspectRatio: string | null;
};

@Injectable()
export class MuxService {
  private readonly logger = new Logger(MuxService.name);
  private readonly client: Mux;
  private readonly webhookSecret: string;
  private readonly corsOrigin: string;

  constructor() {
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;
    const webhookSecret = process.env.MUX_WEBHOOK_SIGNING_SECRET;

    if (!tokenId || !tokenSecret) {
      throw new Error('MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set');
    }
    if (!webhookSecret) {
      throw new Error('MUX_WEBHOOK_SIGNING_SECRET must be set');
    }

    this.client = new Mux({ tokenId, tokenSecret, webhookSecret });
    this.webhookSecret = webhookSecret;
    this.corsOrigin = process.env.MUX_UPLOAD_CORS_ORIGIN ?? '*';
  }

  async createDirectUpload(): Promise<MuxDirectUpload> {
    const upload = await this.client.video.uploads.create({
      cors_origin: this.corsOrigin,
      new_asset_settings: {
        playback_policies: ['public'],
        video_quality: 'basic',
      },
    });

    if (!upload.url) {
      throw new InternalServerErrorException('Mux did not return an upload URL');
    }

    return { uploadId: upload.id, uploadUrl: upload.url };
  }

  async createAssetFromUrl(url: string): Promise<{ assetId: string }> {
    const asset = await this.client.video.assets.create({
      inputs: [{ url }],
      playback_policies: ['public'],
      video_quality: 'basic',
    });
    return { assetId: asset.id };
  }

  async retrieveAsset(assetId: string): Promise<MuxAssetSnapshot> {
    const asset = await this.client.video.assets.retrieve(assetId);
    return {
      assetId: asset.id,
      playbackId: asset.playback_ids?.[0]?.id ?? null,
      status: asset.status,
      durationSec: asset.duration ?? null,
      aspectRatio: asset.aspect_ratio ?? null,
    };
  }

  async deleteAsset(assetId: string): Promise<void> {
    try {
      await this.client.video.assets.delete(assetId);
    } catch (err) {
      // 404 means already gone — treat as success.
      const status = (err as { status?: number }).status;
      if (status !== 404) {
        this.logger.warn(`Failed to delete Mux asset ${assetId}: ${(err as Error).message}`);
        throw err;
      }
    }
  }

  async unwrapWebhook(rawBody: string, headers: IncomingHttpHeaders): Promise<UnwrapWebhookEvent> {
    return this.client.webhooks.unwrap(
      rawBody,
      headers as Record<string, string | string[]>,
      this.webhookSecret
    );
  }

  static playbackUrl(playbackId: string): string {
    return `https://stream.mux.com/${playbackId}.m3u8`;
  }

  static thumbnailUrl(playbackId: string): string {
    return `https://image.mux.com/${playbackId}/thumbnail.jpg`;
  }
}
