import { ApiProperty } from '@nestjs/swagger';
import { UserProfileResponseDto } from './user-profile-response.dto';

export class UserComparisonStatsDto {
  @ApiProperty({ description: 'Total tournaments participated in', example: 12 })
  tournamentCount!: number;

  @ApiProperty({ description: 'Total unlocked achievements', example: 7 })
  achievementCount!: number;

  @ApiProperty({ description: 'Featured achievements on profile', example: 3 })
  featuredAchievementCount!: number;

  @ApiProperty({ description: 'Favorite sports count', example: 2 })
  favoriteSportsCount!: number;
}

export class ComparisonSideDto {
  @ApiProperty({ type: UserProfileResponseDto })
  profile!: UserProfileResponseDto;

  @ApiProperty({ type: UserComparisonStatsDto })
  stats!: UserComparisonStatsDto;
}

export class ProfileComparisonResponseDto {
  @ApiProperty({ type: ComparisonSideDto })
  a!: ComparisonSideDto;

  @ApiProperty({ type: ComparisonSideDto })
  b!: ComparisonSideDto;
}
