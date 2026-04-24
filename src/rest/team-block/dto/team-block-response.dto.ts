import { ApiProperty } from '@nestjs/swagger';

export class TeamBlockResponseDto {
  @ApiProperty({ description: 'Block record ID', example: 'clr1abc2d0000', type: String })
  id!: string;

  @ApiProperty({ description: 'ID of the team that initiated the block', type: String })
  blockingTeamId!: string;

  @ApiProperty({ description: 'ID of the blocked team', type: String })
  blockedTeamId!: string;

  @ApiProperty({ description: 'Name of the blocked team', example: 'Team Alpha', type: String })
  blockedTeamName!: string;

  @ApiProperty({ description: 'When the block was created', format: 'date-time', type: String })
  createdAt!: string;
}
