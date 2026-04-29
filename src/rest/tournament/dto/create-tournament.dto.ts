import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsOptional,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTournamentDto {
  @ApiProperty({
    description: 'Tournament name',
    example: 'Spring Championship 2024',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Sport ID (UUID)',
    example: 'a1b2c3d4-0001-4000-8000-000000000001',
    type: String,
  })
  @IsUUID()
  @IsNotEmpty()
  sportId!: string;

  @ApiProperty({
    description: 'Organization ID hosting the tournament',
    example: 'clr1abc2d0000',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({
    description: 'Maximum number of teams (must be a power of 2 for SINGLE_ELIMINATION)',
    example: 16,
    minimum: 2,
    type: Number,
  })
  @IsInt()
  @Min(2)
  maxTeams!: number;

  @ApiProperty({
    description: 'Tournament start date (ISO 8601)',
    example: '2024-06-01T09:00:00Z',
    type: String,
  })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiPropertyOptional({
    description: 'Tournament format',
    enum: ['SINGLE_ELIMINATION', 'ROUND_ROBIN'],
    example: 'SINGLE_ELIMINATION',
  })
  @IsOptional()
  @IsIn(['SINGLE_ELIMINATION', 'ROUND_ROBIN'])
  format?: 'SINGLE_ELIMINATION' | 'ROUND_ROBIN';

  @ApiPropertyOptional({
    description:
      'Registration closing time (ISO 8601). After this time, joinTournament rejects new registrations.',
    type: String,
    example: '2024-05-30T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  registrationClosesAt?: string;
}
