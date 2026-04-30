import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const PUSH_PLATFORMS = ['IOS', 'WEB'] as const;
export type PushPlatformDto = (typeof PUSH_PLATFORMS)[number];

export const registerPushDeviceSchema = z
  .object({
    platform: z.enum(PUSH_PLATFORMS),
    token: z.string().min(1).max(2048),
    userAgent: z.string().max(512).optional(),
    subscription: z
      .object({
        endpoint: z.string().url(),
        expirationTime: z.number().nullable().optional(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      })
      .optional(),
  })
  .refine((v) => v.platform !== 'WEB' || !!v.subscription, {
    message: 'subscription is required for WEB platform',
    path: ['subscription'],
  });

export type RegisterPushDeviceInput = z.infer<typeof registerPushDeviceSchema>;

export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'p256dh key for VAPID encryption' })
  p256dh!: string;

  @ApiProperty({ description: 'auth secret for VAPID encryption' })
  auth!: string;
}

export class PushSubscriptionDto {
  @ApiProperty({ description: 'Push service endpoint URL' })
  endpoint!: string;

  @ApiProperty({ required: false, nullable: true, type: Number })
  expirationTime?: number | null;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  keys!: PushSubscriptionKeysDto;
}

export class RegisterPushDeviceDto {
  @ApiProperty({ enum: PUSH_PLATFORMS, description: 'Device platform' })
  platform!: PushPlatformDto;

  @ApiProperty({
    description: 'APNs device token (IOS) or unique key derived from endpoint (WEB)',
  })
  token!: string;

  @ApiProperty({ required: false, description: 'User-Agent of the registering device' })
  userAgent?: string;

  @ApiProperty({
    required: false,
    type: PushSubscriptionDto,
    description: 'Full Web Push subscription (required for WEB)',
  })
  subscription?: PushSubscriptionDto;
}

export class PushDeviceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PUSH_PLATFORMS })
  platform!: PushPlatformDto;

  @ApiProperty({ description: 'Last 8 chars of the device token (for display only)' })
  tokenHint!: string;

  @ApiProperty({ required: false, nullable: true })
  userAgent?: string | null;

  @ApiProperty({ format: 'date-time' })
  lastSeenAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class VapidPublicKeyResponseDto {
  @ApiProperty({ description: 'Base64url-encoded VAPID public key' })
  publicKey!: string;
}
