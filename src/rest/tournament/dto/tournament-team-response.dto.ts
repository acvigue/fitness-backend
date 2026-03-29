import { ApiProperty } from '@nestjs/swagger';

export class TournamentTeamResponseDto {
  @ApiProperty({ description: 'Team ID', example: 'cm123abc456def789ghi0001' })
  id!: string;

  @ApiProperty({ description: 'Team name', example: 'Purdue Badminton A' })
  name!: string;

  @ApiProperty({ description: 'Team captain user ID' })
  captainId!: string;
}
