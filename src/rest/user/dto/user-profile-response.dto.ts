import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SportResponseDto } from '@/rest/sport/dto/sport-response.dto';
import { UserAchievementResponseDto } from '@/rest/achievement/dto/user-achievement-response.dto';

export class UserProfilePictureDto {
  @ApiProperty({ description: 'Picture ID', example: 'clr1abc2d0000' })
  id!: string;

  @ApiProperty({ description: 'Picture URL', example: 'https://example.com/photo.jpg' })
  url!: string;

  @ApiPropertyOptional({ description: 'Alt text', example: 'Profile photo' })
  alt?: string;

  @ApiProperty({ description: 'Whether this is the primary picture', example: true })
  isPrimary!: boolean;
}

export class UserProfileResponseDto {
  @ApiProperty({ description: 'User ID', example: 'auth0|507f1f77bcf86cd799439011' })
  userId!: string;

  @ApiPropertyOptional({ description: 'User bio', example: 'Fitness enthusiast' })
  bio!: string | null;

  @ApiProperty({ type: [SportResponseDto], description: 'Favorite sports' })
  favoriteSports!: SportResponseDto[];

  @ApiProperty({ type: [UserProfilePictureDto], description: 'Profile pictures' })
  pictures!: UserProfilePictureDto[];

  @ApiProperty({
    type: [UserAchievementResponseDto],
    description: 'Featured achievements (up to 5)',
  })
  featuredAchievements!: UserAchievementResponseDto[];
}
