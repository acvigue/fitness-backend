import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PushSubscription } from 'web-push';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/utils';
import { NOTIFICATION_TYPES, type NotificationType } from '@/rest/notification/notification-types';
import { ApnsProvider } from './apns.provider';
import { WebPushProvider } from './webpush.provider';
import {
  type RegisterPushDeviceInput,
  type UpdatePushPreferencesInput,
} from './dto';
import type {
  PushDeviceResponseDto,
  PushPreferencesResponseDto,
} from './dto';

/**
 * Notification types that *default to enabled* for push when the user has
 * granted permission and registered a device. Everything else defaults to off
 * so users opt-in per type from Settings.
 */
const DEFAULT_PUSH_ENABLED_TYPES: ReadonlySet<NotificationType> = new Set([
  'TEAM_INVITE',
  'TOURNAMENT_REMINDER',
  'TOURNAMENT_INVITATION_RECEIVED',
  'MEETUP_PROPOSAL',
]);

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly apns: ApnsProvider,
    private readonly webpush: WebPushProvider
  ) {}

  async registerDevice(
    userId: string,
    input: RegisterPushDeviceInput
  ): Promise<PushDeviceResponseDto> {
    const device = await prisma.pushDevice.upsert({
      where: { userId_token: { userId, token: input.token } },
      create: {
        userId,
        platform: input.platform,
        token: input.token,
        userAgent: input.userAgent,
        subscription: input.subscription
          ? (input.subscription as unknown as object)
          : undefined,
      },
      update: {
        platform: input.platform,
        userAgent: input.userAgent,
        subscription: input.subscription
          ? (input.subscription as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        lastSeenAt: new Date(),
      },
    });
    return this.toDeviceResponse(device);
  }

  async unregisterDevice(userId: string, id: string): Promise<void> {
    const existing = await prisma.pushDevice.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Device not found');
    }
    await prisma.pushDevice.delete({ where: { id } });
  }

  async listDevices(userId: string): Promise<PushDeviceResponseDto[]> {
    const devices = await prisma.pushDevice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return devices.map((d) => this.toDeviceResponse(d));
  }

  async getPreferences(userId: string): Promise<PushPreferencesResponseDto> {
    const stored = await prisma.pushPreference.findMany({ where: { userId } });
    const byType = new Map(stored.map((p) => [p.type, p.enabled]));
    return {
      preferences: NOTIFICATION_TYPES.map((type) => ({
        type,
        enabled: byType.get(type) ?? DEFAULT_PUSH_ENABLED_TYPES.has(type),
      })),
    };
  }

  async updatePreferences(
    userId: string,
    input: UpdatePushPreferencesInput
  ): Promise<PushPreferencesResponseDto> {
    await prisma.$transaction(
      input.preferences.map((p) =>
        prisma.pushPreference.upsert({
          where: { userId_type: { userId, type: p.type } },
          create: { userId, type: p.type, enabled: p.enabled },
          update: { enabled: p.enabled },
        })
      )
    );
    return this.getPreferences(userId);
  }

  /**
   * Send a push to all of a user's registered devices. Failures are logged
   * but never thrown — callers should treat this as fire-and-forget.
   */
  async sendToUser(
    userId: string,
    type: NotificationType,
    payload: { title: string; body: string; data?: Record<string, unknown> }
  ): Promise<void> {
    if (!(await this.isEnabledForUser(userId, type))) {
      return;
    }

    const devices = await prisma.pushDevice.findMany({ where: { userId } });
    if (devices.length === 0) return;

    const apnsTokens = devices.filter((d) => d.platform === 'IOS').map((d) => d.token);
    const webSubs = devices
      .filter((d) => d.platform === 'WEB' && d.subscription)
      .map((d) => ({
        id: d.id,
        token: d.token,
        subscription: d.subscription as unknown as PushSubscription,
      }));

    const [apnsRes, webRes] = await Promise.all([
      this.apns.send(apnsTokens, payload),
      this.webpush.send(webSubs, payload),
    ]);

    const permanentApnsFailures = apnsRes.failed.filter((f) => f.permanent).map((f) => f.token);
    const permanentWebFailures = webRes.failed.filter((f) => f.permanent).map((f) => f.endpoint);

    if (permanentApnsFailures.length > 0) {
      await prisma.pushDevice.deleteMany({
        where: { userId, platform: 'IOS', token: { in: permanentApnsFailures } },
      });
    }
    if (permanentWebFailures.length > 0) {
      const matchedIds = webSubs
        .filter((s) => permanentWebFailures.includes(s.subscription.endpoint))
        .map((s) => s.id);
      if (matchedIds.length > 0) {
        await prisma.pushDevice.deleteMany({ where: { id: { in: matchedIds } } });
      }
    }
  }

  private async isEnabledForUser(userId: string, type: NotificationType): Promise<boolean> {
    const pref = await prisma.pushPreference.findUnique({
      where: { userId_type: { userId, type } },
    });
    if (pref) return pref.enabled;
    return DEFAULT_PUSH_ENABLED_TYPES.has(type);
  }

  private toDeviceResponse(device: {
    id: string;
    platform: 'IOS' | 'WEB';
    token: string;
    userAgent: string | null;
    lastSeenAt: Date;
    createdAt: Date;
  }): PushDeviceResponseDto {
    return {
      id: device.id,
      platform: device.platform,
      tokenHint: device.token.slice(-8),
      userAgent: device.userAgent,
      lastSeenAt: device.lastSeenAt.toISOString(),
      createdAt: device.createdAt.toISOString(),
    };
  }
}
