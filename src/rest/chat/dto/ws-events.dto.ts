import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageResponseDto } from './message-response.dto';

// ─── Incoming payloads (client → server) ──────────────────

export class WsSendMessageDto {
  @ApiProperty({
    description: 'Chat ID to send the message to',
    example: 'clr1abc2d0000',
    type: String,
  })
  chatId!: string;

  @ApiProperty({
    description: 'Message content (max 5000 chars)',
    example: 'Hey, want to work out?',
    type: String,
  })
  content!: string;

  @ApiPropertyOptional({
    description: 'List of media asset IDs to attach',
    example: ['cm1abc123def456'],
    type: [String],
  })
  mediaIds?: string[];
}

export class WsJoinChatDto {
  @ApiProperty({ description: 'Chat ID to join', example: 'clr1abc2d0000', type: String })
  chatId!: string;
}

export class WsTypingDto {
  @ApiProperty({
    description: 'Chat ID where user is typing',
    example: 'clr1abc2d0000',
    type: String,
  })
  chatId!: string;
}

// ─── Outgoing/response payloads (server → client) ─────────

export class WsSendMessageResponseDto {
  @ApiProperty({ description: 'Whether the operation succeeded', example: true, type: Boolean })
  success!: boolean;

  @ApiPropertyOptional({ description: 'The created message', type: MessageResponseDto })
  data?: MessageResponseDto;

  @ApiPropertyOptional({
    description: 'Error message if failed',
    example: 'You are not a member of this chat',
    type: String,
  })
  error?: string;
}

export class WsAckResponseDto {
  @ApiProperty({ description: 'Whether the operation succeeded', example: true, type: Boolean })
  success!: boolean;

  @ApiPropertyOptional({ description: 'Error message if failed', type: String })
  error?: string;
}

export class WsTypingEventDto {
  @ApiProperty({ description: 'Chat ID', example: 'clr1abc2d0000', type: String })
  chatId!: string;

  @ApiProperty({
    description: 'User ID who is typing',
    example: 'auth0|507f1f77bcf86cd799439011',
    type: String,
  })
  userId!: string;

  @ApiPropertyOptional({
    description: 'Username of the typing user',
    example: 'john.doe',
    type: String,
  })
  username?: string;
}

export class WsTypingStopEventDto {
  @ApiProperty({ description: 'Chat ID', example: 'clr1abc2d0000', type: String })
  chatId!: string;

  @ApiProperty({
    description: 'User ID who stopped typing',
    example: 'auth0|507f1f77bcf86cd799439011',
    type: String,
  })
  userId!: string;
}
