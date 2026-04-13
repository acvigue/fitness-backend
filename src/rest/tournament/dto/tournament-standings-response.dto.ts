import { ApiProperty } from '@nestjs/swagger';
import { TournamentTeamResponseDto } from './tournament-team-response.dto';

export class TeamStandingDto {
  @ApiProperty({ description: 'Team info', type: () => TournamentTeamResponseDto })
  team!: TournamentTeamResponseDto;

  @ApiProperty({ description: 'Matches played', example: 3 })
  played!: number;

  @ApiProperty({ description: 'Matches won', example: 2 })
  wins!: number;

  @ApiProperty({ description: 'Matches lost', example: 1 })
  losses!: number;

  @ApiProperty({ description: 'Matches drawn', example: 0 })
  draws!: number;

  @ApiProperty({ description: 'Points scored', example: 9 })
  pointsFor!: number;

  @ApiProperty({ description: 'Points conceded', example: 5 })
  pointsAgainst!: number;

  @ApiProperty({ description: 'Point differential', example: 4 })
  pointDiff!: number;
}

export class TournamentStandingsResponseDto {
  @ApiProperty({ description: 'Tournament ID', example: 'clr1abc2d0001' })
  tournamentId!: string;

  @ApiProperty({
    description: 'Team standings sorted by wins then point differential',
    type: [TeamStandingDto],
  })
  standings!: TeamStandingDto[];
}
