import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageSenderDto {
  @ApiProperty({
    description: 'Sender user ID',
    example: 'auth0|507f1f77bcf86cd799439011',
    type: String,
  })
  id!: string;

  @ApiPropertyOptional({ description: 'Sender username', example: 'john.doe', type: String })
  username!: string | null;

  @ApiPropertyOptional({ description: 'Sender display name', example: 'John Doe', type: String })
  name!: string | null;
}

export class MediaAttachmentDto {
  @ApiProperty({ description: 'Media asset ID', example: 'cm1abc123def456', type: String })
  id!: string;

  @ApiProperty({
    description: 'Public URL',
    example: 'https://assets.fittime.app/fittime/assets/cm1abc123def456.jpg',
    type: String,
  })
  url!: string;

  @ApiProperty({ description: 'MIME type', example: 'image/jpeg', type: String })
  mimeType!: string;
}

export class MessageResponseDto {
  @ApiProperty({ description: 'Message ID', example: 'clr1abc2d0001', type: String })
  id!: string;

  @ApiProperty({
    description: 'Chat ID this message belongs to',
    example: 'clr1abc2d0000',
    type: String,
  })
  chatId!: string;

  @ApiProperty({ type: MessageSenderDto, description: 'Sender information' })
  sender!: MessageSenderDto;

  @ApiProperty({
    description: 'Message content',
    example: 'Hey, want to work out today?',
    type: String,
  })
  content!: string;

  @ApiProperty({
    description: 'Message type',
    example: 'TEXT',
    enum: ['TEXT', 'IMAGE', 'VIDEO', 'FILE'],
  })
  type!: string;

  @ApiPropertyOptional({
    description: 'Media URL for non-text messages (legacy)',
    example: 'https://cdn.example.com/img.jpg',
    type: String,
  })
  mediaUrl!: string | null;

  @ApiProperty({
    description: 'Attached media assets',
    type: [MediaAttachmentDto],
  })
  media!: MediaAttachmentDto[];

  @ApiProperty({ description: 'Whether the message has been read', example: false, type: Boolean })
  read!: boolean;

  @ApiProperty({ description: 'Timestamp when the message was sent', format: 'date-time' })
  createdAt!: Date;
}
