import { ApiProperty } from '@nestjs/swagger';
import { TournamentTeamResponseDto } from './tournament-team-response.dto';

export class TeamStandingDto {
  @ApiProperty({ description: 'Team info', type: () => TournamentTeamResponseDto })
  team!: TournamentTeamResponseDto;

  @ApiProperty({ description: 'Matches played', example: 3, type: Number })
  played!: number;

  @ApiProperty({ description: 'Matches won', example: 2, type: Number })
  wins!: number;

  @ApiProperty({ description: 'Matches lost', example: 1, type: Number })
  losses!: number;

  @ApiProperty({ description: 'Matches drawn', example: 0, type: Number })
  draws!: number;

  @ApiProperty({ description: 'Points scored', example: 9, type: Number })
  pointsFor!: number;

  @ApiProperty({ description: 'Points conceded', example: 5, type: Number })
  pointsAgainst!: number;

  @ApiProperty({ description: 'Point differential', example: 4, type: Number })
  pointDiff!: number;
}

export class TournamentStandingsResponseDto {
  @ApiProperty({ description: 'Tournament ID', example: 'clr1abc2d0001', type: String })
  tournamentId!: string;

  @ApiProperty({
    description: 'Team standings sorted by wins then point differential',
    type: [TeamStandingDto],
  })
  standings!: TeamStandingDto[];
}
