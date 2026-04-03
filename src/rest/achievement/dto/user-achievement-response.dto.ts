import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AchievementDefinitionResponseDto } from './achievement-definition-response.dto';

export class UserAchievementResponseDto {
  @ApiPropertyOptional({
    description: 'User achievement ID (null if not yet started)',
    example: 'cm123abc',
    nullable: true,
    type: String,
  })
  id!: string | null;

  @ApiProperty({ description: 'Current progress', example: 3 })
  progress!: number;

  @ApiPropertyOptional({ description: 'Date achievement was unlocked', format: 'date-time' })
  unlockedAt!: string | null;

  @ApiProperty({
    description: 'Achievement definition',
    type: () => AchievementDefinitionResponseDto,
  })
  achievement!: AchievementDefinitionResponseDto;
}
