import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import apn from '@parse/node-apn';

export interface ApnsSendResult {
  failed: { token: string; reason: string; permanent: boolean }[];
}

export interface ApnsPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const PERMANENT_FAILURE_REASONS = new Set([
  'BadDeviceToken',
  'Unregistered',
  'DeviceTokenNotForTopic',
  'TopicDisallowed',
]);

@Injectable()
export class ApnsProvider implements OnModuleDestroy {
  private readonly logger = new Logger(ApnsProvider.name);
  private provider?: apn.Provider;
  private readonly bundleId?: string;

  constructor() {
    const key = process.env.APNS_KEY;
    const keyId = process.env.APNS_KEY_ID;
    const teamId = process.env.APNS_TEAM_ID;
    this.bundleId = process.env.APNS_BUNDLE_ID;
    const production = process.env.APNS_PRODUCTION === 'true';

    if (!key || !keyId || !teamId || !this.bundleId) {
      this.logger.warn('APNs credentials missing — iOS push will be disabled');
      return;
    }

    this.provider = new apn.Provider({
      token: { key, keyId, teamId },
      production,
    });
  }

  isReady(): boolean {
    return this.provider !== undefined;
  }

  async send(tokens: string[], payload: ApnsPayload): Promise<ApnsSendResult> {
    if (!this.provider || !this.bundleId || tokens.length === 0) {
      return { failed: [] };
    }

    const note = new apn.Notification();
    note.topic = this.bundleId;
    note.alert = { title: payload.title, body: payload.body };
    note.sound = 'default';
    note.contentAvailable = true;
    if (payload.data) note.payload = payload.data;
    note.expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 1d

    const result = await this.provider.send(note, tokens);
    const failed: ApnsSendResult['failed'] = [];

    for (const f of result.failed ?? []) {
      const reason = f.response?.reason ?? f.error?.message ?? 'unknown';
      const permanent = PERMANENT_FAILURE_REASONS.has(reason);
      failed.push({ token: f.device, reason, permanent });
    }

    if (failed.length > 0) {
      this.logger.warn(`APNs send: ${result.sent.length} sent, ${failed.length} failed`);
    }

    return { failed };
  }

  async onModuleDestroy(): Promise<void> {
    this.provider?.shutdown();
  }
}
