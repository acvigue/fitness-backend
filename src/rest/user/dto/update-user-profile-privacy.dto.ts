import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserProfilePrivacyDto {
  @ApiProperty({ description: "Privacy Setting for Bio's", example: 'false' })
  privateBio!: boolean;

  @ApiPropertyOptional({ description: 'Privacy Setting for Favorite Sports', example: 'false' })
  privateSports!: boolean;

  @ApiPropertyOptional({ description: 'Privacy Setting for Tournaments', example: 'false' })
  privateTournaments!: boolean;

  @ApiPropertyOptional({
    description: 'Privacy Setting for Featured Achievements',
    example: 'false',
  })
  privateAchievements!: boolean;
}
