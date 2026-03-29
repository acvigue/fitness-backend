import { ApiProperty } from '@nestjs/swagger';
import { SportResponseDto } from '@/rest/sport/dto/sport-response.dto';
import { UserResponseDto } from '@/rest/user/dto/user-response.dto';
import { TournamentTeamResponseDto } from './tournament-team-response.dto';
import { TournamentStatus } from '@/generated/prisma/enums';
import { PaginationMetaDto } from '@/rest/common/pagination';

export class TournamentResponseDto {
  @ApiProperty({
    description: 'Tournament ID',
    example: 'clr1abc2d0001',
  })
  id!: string;

  @ApiProperty({ description: 'Tournament name', example: 'Spring Championship 2024' })
  name!: string;

  @ApiProperty({
    description: 'Tournament status',
    enum: TournamentStatus,
    example: TournamentStatus.OPEN,
  })
  status!: TournamentStatus;

  @ApiProperty({ description: 'Maximum number of teams', example: 16 })
  maxTeams!: number;

  @ApiProperty({ description: 'Organization ID', example: 'clr1abc2d0000' })
  organizationId!: string;

  @ApiProperty({ description: 'Creator user ID', example: 'auth0|507f1f77bcf86cd799439011' })
  createdById!: string;

  @ApiProperty({
    description: 'Tournament start date (ISO 8601)',
    example: '2024-06-01T09:00:00.000Z',
    format: 'date-time',
  })
  startDate!: string;

  @ApiProperty({
    description: 'Tournament creation date (ISO 8601)',
    example: '2024-03-01T12:00:00.000Z',
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({ description: 'Associated sport', type: () => SportResponseDto })
  sport!: SportResponseDto;

  @ApiProperty({ description: 'List of tournament participants', type: () => [UserResponseDto] })
  participants!: UserResponseDto[];

  @ApiProperty({ description: 'List of registered teams', type: () => [TournamentTeamResponseDto] })
  teams!: TournamentTeamResponseDto[];
}

export class PaginatedTournamentResponseDto {
  @ApiProperty({ type: [TournamentResponseDto] })
  data!: TournamentResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
