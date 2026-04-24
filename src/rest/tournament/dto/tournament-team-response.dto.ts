import { ApiProperty } from '@nestjs/swagger';

export class TournamentTeamResponseDto {
  @ApiProperty({ description: 'Team ID', example: 'cm123abc456def789ghi0001', type: String })
  id!: string;

  @ApiProperty({ description: 'Team name', example: 'Purdue Badminton A', type: String })
  name!: string;

  @ApiProperty({ description: 'Team captain user ID', type: String })
  captainId!: string;
}
