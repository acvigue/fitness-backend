import { ApiProperty } from '@nestjs/swagger';
import { TournamentMatchResponseDto } from './tournament-match-response.dto';

export class BracketRoundDto {
  @ApiProperty({ description: 'Round number (1-based)', example: 1 })
  round!: number;

  @ApiProperty({ description: 'Round label', example: 'Quarterfinals' })
  label!: string;

  @ApiProperty({ description: 'Matches in this round', type: [TournamentMatchResponseDto] })
  matches!: TournamentMatchResponseDto[];
}

export class TournamentBracketResponseDto {
  @ApiProperty({ description: 'Tournament ID', example: 'clr1abc2d0001' })
  tournamentId!: string;

  @ApiProperty({ description: 'Total number of rounds', example: 3 })
  totalRounds!: number;

  @ApiProperty({ description: 'Bracket rounds', type: [BracketRoundDto] })
  rounds!: BracketRoundDto[];
}
