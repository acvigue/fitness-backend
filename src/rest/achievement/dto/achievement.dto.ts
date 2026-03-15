import { ApiProperty } from '@nestjs/swagger';

export class AchievementDto {
  @ApiProperty({ description: 'Title of Achievement', example: 'Winner of Tournament' })
  title!: string;

  @ApiProperty({ description: 'Description of Achievement', example: 'Finished 8-1' })
  description!: string;

  @ApiProperty({
    description: 'Time an Achievement was Earned',
    example: 'April 12, 2026, 17:00:00',
  })
  earnedAt!: string;
}
