import { Injectable, Logger } from '@nestjs/common';
import webpush, { type PushSubscription } from 'web-push';

export interface WebPushSendResult {
  failed: { endpoint: string; statusCode?: number; permanent: boolean }[];
}

export interface WebPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class WebPushProvider {
  private readonly logger = new Logger(WebPushProvider.name);
  private readonly publicKey?: string;
  private ready = false;

  constructor() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
      this.logger.warn('VAPID credentials missing — Web Push will be disabled');
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.publicKey = publicKey;
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  getPublicKey(): string | undefined {
    return this.publicKey;
  }

  async send(
    subscriptions: { id: string; subscription: PushSubscription }[],
    payload: WebPushPayload
  ): Promise<WebPushSendResult> {
    if (!this.ready || subscriptions.length === 0) {
      return { failed: [] };
    }

    const body = JSON.stringify(payload);
    const failed: WebPushSendResult['failed'] = [];

    await Promise.all(
      subscriptions.map(async ({ subscription }) => {
        try {
          await webpush.sendNotification(subscription, body);
        } catch (err: unknown) {
          const e = err as { statusCode?: number; message?: string };
          const statusCode = e.statusCode;
          const permanent = statusCode === 404 || statusCode === 410;
          failed.push({ endpoint: subscription.endpoint, statusCode, permanent });
        }
      })
    );

    if (failed.length > 0) {
      this.logger.warn(
        `WebPush send: ${subscriptions.length - failed.length} sent, ${failed.length} failed`
      );
    }

    return { failed };
  }
}
