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
import { TournamentFormat } from '@/generated/prisma/enums';

export class CreateTournamentDto {
  @ApiProperty({ description: 'Tournament name', example: 'Spring Championship 2024' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Sport ID (UUID)', example: 'a1b2c3d4-0001-4000-8000-000000000001' })
  @IsUUID()
  @IsNotEmpty()
  sportId!: string;

  @ApiProperty({ description: 'Organization ID hosting the tournament', example: 'clr1abc2d0000' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({
    description: 'Maximum number of teams (must be a power of 2 for SINGLE_ELIMINATION)',
    example: 16,
    minimum: 2,
  })
  @IsInt()
  @Min(2)
  maxTeams!: number;

  @ApiProperty({ description: 'Tournament start date (ISO 8601)', example: '2024-06-01T09:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiPropertyOptional({
    description: 'Tournament format (defaults to SINGLE_ELIMINATION)',
    enum: ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION'],
    example: 'SINGLE_ELIMINATION',
  })
  @IsIn(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION'])
  @IsOptional()
  format?: string;
}
