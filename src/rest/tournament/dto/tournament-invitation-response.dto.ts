import { ApiProperty } from '@nestjs/swagger';

export class TournamentInvitationResponseDto {
  @ApiProperty({ description: 'Invitation ID', example: 'cm123abc456def789ghi0001', type: String })
  id!: string;

  @ApiProperty({ description: 'Tournament ID', type: String })
  tournamentId!: string;

  @ApiProperty({ description: 'Team ID', type: String })
  teamId!: string;

  @ApiProperty({
    description: 'Invitation status',
    enum: ['PENDING', 'ACCEPTED', 'DECLINED'],
    example: 'PENDING',
  })
  status!: string;

  @ApiProperty({ description: 'Creation timestamp', format: 'date-time', type: String })
  createdAt!: string;
}
