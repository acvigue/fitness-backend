import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserProfilePrivacyDto {
  @ApiProperty({ description: "Privacy Setting for Bio's", example: false, type: Boolean })
  @IsBoolean()
  privateBio!: boolean;

  @ApiProperty({
    description: 'Privacy Setting for Favorite Sports',
    example: false,
    type: Boolean,
  })
  @IsBoolean()
  privateSports!: boolean;

  @ApiProperty({ description: 'Privacy Setting for Tournaments', example: false, type: Boolean })
  @IsBoolean()
  privateTournaments!: boolean;

  @ApiProperty({
    description: 'Privacy Setting for Featured Achievements',
    example: false,
    type: Boolean,
  })
  @IsBoolean()
  privateAchievements!: boolean;
}
