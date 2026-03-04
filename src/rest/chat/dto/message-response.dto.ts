import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageSenderDto {
  @ApiProperty({ description: 'Sender user ID', example: 'auth0|507f1f77bcf86cd799439011' })
  id!: string;

  @ApiPropertyOptional({ description: 'Sender username', example: 'john.doe' })
  username!: string | null;

  @ApiPropertyOptional({ description: 'Sender display name', example: 'John Doe' })
  name!: string | null;
}

export class MessageResponseDto {
  @ApiProperty({ description: 'Message ID', example: 'clr1abc2d0001' })
  id!: string;

  @ApiProperty({ description: 'Chat ID this message belongs to', example: 'clr1abc2d0000' })
  chatId!: string;

  @ApiProperty({ type: MessageSenderDto, description: 'Sender information' })
  sender!: MessageSenderDto;

  @ApiProperty({ description: 'Message content', example: 'Hey, want to work out today?' })
  content!: string;

  @ApiProperty({
    description: 'Message type',
    example: 'TEXT',
    enum: ['TEXT', 'IMAGE', 'VIDEO', 'FILE'],
  })
  type!: string;

  @ApiPropertyOptional({
    description: 'Media URL for non-text messages',
    example: 'https://cdn.example.com/img.jpg',
  })
  mediaUrl!: string | null;

  @ApiProperty({ description: 'Whether the message has been read', example: false })
  read!: boolean;

  @ApiProperty({ description: 'Timestamp when the message was sent', format: 'date-time' })
  createdAt!: Date;
}
