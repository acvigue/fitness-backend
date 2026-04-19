import { ApiProperty } from '@nestjs/swagger';
import { ChatMemberDto } from '@/rest/chat/dto/chat-response.dto';

export class TeamChatResponseDto {
  @ApiProperty({ description: 'Chat ID', example: 'clr1abc2d0000' })
  id!: string;

  @ApiProperty({ description: 'Chat name', example: 'Team Alpha x Team Beta' })
  name!: string | null;

  @ApiProperty({ description: 'Team 1 ID' })
  team1Id!: string;

  @ApiProperty({ description: 'Team 2 ID' })
  team2Id!: string;

  @ApiProperty({ type: [ChatMemberDto], description: 'Chat members' })
  members!: ChatMemberDto[];

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;
}
