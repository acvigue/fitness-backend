import { ApiProperty } from '@nestjs/swagger';

export class TeamBlockResponseDto {
  @ApiProperty({ description: 'Block record ID', example: 'clr1abc2d0000' })
  id!: string;

  @ApiProperty({ description: 'ID of the team that initiated the block' })
  blockingTeamId!: string;

  @ApiProperty({ description: 'ID of the blocked team' })
  blockedTeamId!: string;

  @ApiProperty({ description: 'Name of the blocked team', example: 'Team Alpha' })
  blockedTeamName!: string;

  @ApiProperty({ description: 'When the block was created', format: 'date-time' })
  createdAt!: string;
}
