import { ApiProperty } from '@nestjs/swagger';
import { NOTIFICATION_TYPES, type NotificationType } from '../notification-types';

export class NotificationResponseDto {
  @ApiProperty({
    description: 'Notification ID',
    example: 'cm123abc456def789ghi0001',
    type: String,
  })
  id!: string;

  @ApiProperty({
    description: 'Notification type',
    example: 'TEAM_INVITE',
    enum: NOTIFICATION_TYPES,
  })
  type!: NotificationType;

  @ApiProperty({ description: 'Notification title', example: 'Team Invitation', type: String })
  title!: string;

  @ApiProperty({
    description: 'Notification content',
    example: 'You have been invited to join Team Alpha',
    type: String,
  })
  content!: string;

  @ApiProperty({
    description: 'Additional structured metadata for client routing/actions',
    required: false,
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  metadata?: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Timestamp the notification was marked read',
    type: 'string',
    format: 'date-time',
    required: false,
    nullable: true,
  })
  readAt?: string | null;

  @ApiProperty({
    description: 'Whether the notification has been dismissed',
    example: false,
    type: Boolean,
  })
  dismissed!: boolean;

  @ApiProperty({ description: 'Creation timestamp', format: 'date-time', type: String })
  createdAt!: string;
}
