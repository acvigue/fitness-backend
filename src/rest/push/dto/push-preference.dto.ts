import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { NOTIFICATION_TYPES, type NotificationType } from '@/rest/notification/notification-types';

export const updatePushPreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        type: z.enum(NOTIFICATION_TYPES),
        enabled: z.boolean(),
      })
    )
    .max(NOTIFICATION_TYPES.length),
});

export type UpdatePushPreferencesInput = z.infer<typeof updatePushPreferencesSchema>;

export class PushPreferenceItemDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES })
  type!: NotificationType;

  @ApiProperty({ description: 'Whether push is enabled for this notification type' })
  enabled!: boolean;
}

export class UpdatePushPreferencesDto {
  @ApiProperty({ type: [PushPreferenceItemDto] })
  preferences!: PushPreferenceItemDto[];
}

export class PushPreferencesResponseDto {
  @ApiProperty({ type: [PushPreferenceItemDto] })
  preferences!: PushPreferenceItemDto[];
}
