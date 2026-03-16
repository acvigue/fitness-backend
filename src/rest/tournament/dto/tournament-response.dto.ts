import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SportResponseDto } from '@/rest/sport/dto/sport-response.dto';
import { UserResponseDto } from '@/rest/user/dto/user-response.dto';
import { IsEnum } from 'class-validator';
import { TournamentStatus } from '@/generated/prisma/enums';

export class TournamentResponseDto {
  @ApiProperty({
    description: 'Tournament ID (UUID)',
    example: 'a1b2c3d4-0001-4000-8000-000000000001',
  })
  id!: string;

  @ApiProperty({ description: 'Tournament name', example: 'Spring Marathon 2024' })
  name!: string;

  @ApiPropertyOptional({ description: 'Tournament status', example: TournamentStatus.UPCOMING })
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @ApiProperty({ description: 'Tournament start date (ISO 8601)', example: '2024-03-01T00:00:00Z' })
  startDate!: string;

  @ApiProperty({
    description: 'Tournament creation date (ISO 8601)',
    example: '2024-03-31T23:59:59Z',
  })
  createdAt!: string;

  @ApiProperty({ description: 'Associated sport', type: () => SportResponseDto })
  sport!: SportResponseDto;

  @ApiProperty({ description: 'List of tournament participants', type: () => [UserResponseDto] })
  participants!: UserResponseDto[];
}
