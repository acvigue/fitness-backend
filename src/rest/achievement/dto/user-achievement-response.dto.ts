import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AchievementDefinitionResponseDto } from './achievement-definition-response.dto';

export class UserAchievementResponseDto {
  @ApiProperty({ description: 'User achievement ID', example: 'cm123abc' })
  id!: string;

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
