import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserProfileResponseDto } from '@/rest/user/dto/user-profile-response.dto';

export class TeamMemberProfileResponseDto {
  @ApiProperty({ description: 'User ID', example: 'auth0|507f1f77bcf86cd799439011', type: String })
  userId!: string;

  @ApiPropertyOptional({ description: 'Username', example: 'john.doe', type: String })
  username!: string | null;

  @ApiPropertyOptional({ description: 'Full name', example: 'John Doe', type: String })
  name!: string | null;

  @ApiPropertyOptional({ description: 'Email address', example: 'john@example.com', type: String })
  email!: string | null;

  @ApiProperty({
    description: 'Whether this user is the team captain',
    example: false,
    type: Boolean,
  })
  isCaptain!: boolean;

  @ApiProperty({ description: 'Full user profile', type: () => UserProfileResponseDto })
  profile!: UserProfileResponseDto;
}
