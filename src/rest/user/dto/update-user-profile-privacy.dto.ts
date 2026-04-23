import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserProfilePrivacyDto {
  @ApiProperty({ description: "Privacy Setting for Bio's", example: 'false' })
  privateBio!: boolean;

  @ApiProperty({ description: 'Privacy Setting for Favorite Sports', example: 'false' })
  privateSports!: boolean;

  @ApiProperty({ description: 'Privacy Setting for Tournaments', example: 'false' })
  privateTournaments!: boolean;

  @ApiProperty({
    description: 'Privacy Setting for Featured Achievements',
    example: 'false',
  })
  privateAchievements!: boolean;
}
