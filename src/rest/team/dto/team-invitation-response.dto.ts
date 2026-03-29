import { ApiProperty } from '@nestjs/swagger';

export class TeamInvitationResponseDto {
  @ApiProperty({ description: 'Invitation ID', example: 'cm123abc456def789ghi0001' })
  id!: string;

  @ApiProperty({ description: 'Team ID' })
  teamId!: string;

  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({
    description: 'Invitation type',
    enum: ['INVITE', 'REQUEST'],
    example: 'INVITE',
  })
  type!: string;

  @ApiProperty({
    description: 'Invitation status',
    enum: ['PENDING', 'ACCEPTED', 'DECLINED'],
    example: 'PENDING',
  })
  status!: string;

  @ApiProperty({ description: 'Creation timestamp', format: 'date-time' })
  createdAt!: string;
}
