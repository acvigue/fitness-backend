import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AchievementDefinitionResponseDto {
  @ApiProperty({ description: 'Achievement definition ID', example: 'cm123abc' })
  id!: string;

  @ApiProperty({ description: 'Achievement name', example: 'First Tournament' })
  name!: string;

  @ApiProperty({
    description: 'Achievement description',
    example: 'Participate in your first tournament',
  })
  description!: string;

  @ApiPropertyOptional({ description: 'Achievement icon URL', example: '/icons/trophy.svg' })
  icon!: string | null;

  @ApiProperty({ description: 'Criteria type', example: 'TOURNAMENT_PARTICIPATION' })
  criteriaType!: string;

  @ApiProperty({ description: 'Threshold to unlock', example: 1 })
  threshold!: number;
}
