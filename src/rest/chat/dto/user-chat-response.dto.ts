import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMemberDto } from './chat-response.dto';
import { MessageResponseDto } from './message-response.dto';

export class UserChatResponseDto {
  @ApiProperty({ description: 'Chat ID', example: 'clr1abc2d0000', type: String })
  id!: string;

  @ApiProperty({ description: 'Chat type', example: 'DIRECT', enum: ['DIRECT', 'GROUP'] })
  type!: string;

  @ApiPropertyOptional({
    description: 'Chat name (null for direct chats)',
    example: 'Gym Buddies',
    type: String,
  })
  name!: string | null;

  @ApiProperty({
    description: 'Creator user ID',
    example: 'auth0|507f1f77bcf86cd799439011',
    type: String,
  })
  creatorId!: string;

  @ApiProperty({ type: [ChatMemberDto], description: 'Chat members' })
  members!: ChatMemberDto[];

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;

  @ApiPropertyOptional({ type: MessageResponseDto, description: 'Most recent message in the chat' })
  lastMessage!: MessageResponseDto | null;
}
