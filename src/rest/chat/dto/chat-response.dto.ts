import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMemberDto {
  @ApiProperty({ description: 'User ID', example: 'auth0|507f1f77bcf86cd799439011' })
  id!: string;

  @ApiPropertyOptional({ description: 'Username', example: 'john.doe' })
  username!: string | null;

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
  name!: string | null;
}

export class ChatResponseDto {
  @ApiProperty({ description: 'Chat ID', example: 'clr1abc2d0000' })
  id!: string;

  @ApiProperty({
    description: 'Chat type',
    example: 'DIRECT',
    enum: ['DIRECT', 'GROUP', 'ANNOUNCEMENT', 'TEAM'],
  })
  type!: string;

  @ApiPropertyOptional({ description: 'Chat name (null for direct chats)', example: 'Gym Buddies' })
  name!: string | null;

  @ApiProperty({ description: 'Creator user ID', example: 'auth0|507f1f77bcf86cd799439011' })
  creatorId!: string;

  @ApiProperty({ type: [ChatMemberDto], description: 'Chat members' })
  members!: ChatMemberDto[];

  @ApiPropertyOptional({ description: 'Organization ID (announcement chats only)' })
  organizationId?: string | null;

  @ApiPropertyOptional({
    description: 'Roles allowed to post (announcement chats only)',
    enum: ['MEMBER', 'STAFF', 'ADMIN'],
    isArray: true,
  })
  writeRoles?: string[];

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;
}
