import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AchievementDefinitionResponseDto {
  @ApiProperty({ description: 'Achievement definition ID', example: 'cm123abc', type: String })
  id!: string;

  @ApiProperty({ description: 'Achievement name', example: 'First Tournament', type: String })
  name!: string;

  @ApiProperty({
    description: 'Achievement description',
    example: 'Participate in your first tournament',
    type: String,
  })
  description!: string;

  @ApiPropertyOptional({
    description: 'Achievement icon URL',
    example: '/icons/trophy.svg',
    type: String,
  })
  icon!: string | null;

  @ApiProperty({ description: 'Criteria type', example: 'TOURNAMENT_PARTICIPATION', type: String })
  criteriaType!: string;

  @ApiProperty({ description: 'Threshold to unlock', example: 1, type: Number })
  threshold!: number;
}
