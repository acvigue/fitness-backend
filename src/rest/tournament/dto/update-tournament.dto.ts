import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsDateString,
  IsInt,
  Min,
  IsOptional,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTournamentDto {
  @ApiPropertyOptional({
    description: 'Tournament name',
    example: 'Updated Championship',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of teams (must be a power of 2)',
    example: 32,
    minimum: 2,
    type: Number,
  })
  @IsInt()
  @Min(2)
  @IsOptional()
  maxTeams?: number;

  @ApiPropertyOptional({
    description: 'Tournament start date (ISO 8601)',
    example: '2024-07-01T09:00:00Z',
    type: String,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Tournament status',
    enum: ['OPEN', 'CLOSED', 'UPCOMING', 'INPROGRESS', 'COMPLETED'],
    example: 'UPCOMING',
  })
  @IsIn(['OPEN', 'CLOSED', 'UPCOMING', 'INPROGRESS', 'COMPLETED'])
  @IsOptional()
  status?: 'OPEN' | 'CLOSED' | 'UPCOMING' | 'INPROGRESS' | 'COMPLETED';
}
