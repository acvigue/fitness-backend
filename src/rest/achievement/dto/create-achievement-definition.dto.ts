import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAchievementDefinitionDto {
  @ApiProperty({ description: 'Achievement name', example: 'First Tournament', type: String })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Achievement description',
    example: 'Participate in your first tournament',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;

  @ApiPropertyOptional({
    description: 'Achievement icon URL',
    example: '/icons/trophy.svg',
    type: String,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  icon?: string;

  @ApiProperty({
    description: 'Criteria type (e.g. TOURNAMENT_PARTICIPATION, TOURNAMENT_WIN)',
    example: 'TOURNAMENT_PARTICIPATION',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  criteriaType!: string;

  @ApiProperty({ description: 'Threshold to unlock', example: 1, minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  threshold!: number;
}
