import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TournamentTeamResponseDto } from './tournament-team-response.dto';

export class TournamentMatchResponseDto {
  @ApiProperty({ description: 'Match ID', example: 'cm123abc456def', type: String })
  id!: string;

  @ApiProperty({ description: 'Round number (1-based)', example: 1, type: Number })
  round!: number;

  @ApiProperty({
    description: 'Match position within the round (1-based)',
    example: 1,
    type: Number,
  })
  matchNumber!: number;

  @ApiPropertyOptional({ description: 'Team 1', type: () => TournamentTeamResponseDto })
  team1!: TournamentTeamResponseDto | null;

  @ApiPropertyOptional({ description: 'Team 2', type: () => TournamentTeamResponseDto })
  team2!: TournamentTeamResponseDto | null;

  @ApiPropertyOptional({ description: 'Team 1 score', example: 3, type: Number })
  team1Score!: number | null;

  @ApiPropertyOptional({ description: 'Team 2 score', example: 1, type: Number })
  team2Score!: number | null;

  @ApiPropertyOptional({ description: 'Winning team', type: () => TournamentTeamResponseDto })
  winner!: TournamentTeamResponseDto | null;

  @ApiProperty({
    description: 'Match status',
    enum: ['PENDING', 'PENDING_CONFIRMATION', 'COMPLETED', 'BYE', 'FORFEIT'],
    example: 'PENDING',
  })
  status!: 'PENDING' | 'PENDING_CONFIRMATION' | 'COMPLETED' | 'BYE' | 'FORFEIT';

  @ApiPropertyOptional({
    description: 'Next match ID the winner advances to',
    example: 'cm456def789ghi',
    type: String,
  })
  nextMatchId!: string | null;

  @ApiPropertyOptional({
    description: 'Team that reported the current pending score, when status is PENDING_CONFIRMATION',
    type: String,
    nullable: true,
  })
  reportedByTeamId!: string | null;

  @ApiPropertyOptional({
    description: 'When the current pending score was reported (ISO 8601)',
    type: String,
    nullable: true,
    format: 'date-time',
  })
  scoreReportedAt!: string | null;
}
