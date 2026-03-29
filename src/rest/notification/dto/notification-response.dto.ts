import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID', example: 'cm123abc456def789ghi0001' })
  id!: string;

  @ApiProperty({ description: 'Notification type', example: 'TEAM_INVITE' })
  type!: string;

  @ApiProperty({ description: 'Notification title', example: 'Team Invitation' })
  title!: string;

  @ApiProperty({
    description: 'Notification content',
    example: 'You have been invited to join Team Alpha',
  })
  content!: string;

  @ApiProperty({ description: 'Whether the notification has been dismissed', example: false })
  dismissed!: boolean;

  @ApiProperty({ description: 'Creation timestamp', format: 'date-time' })
  createdAt!: string;
}
