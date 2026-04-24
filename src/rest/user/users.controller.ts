import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { ProfileComparisonResponseDto } from './dto/profile-comparison-response.dto';
import { ApiBadRequestResponse, ApiCommonErrorResponses, ApiNotFoundResponse } from '@/rest/common';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get('compare')
  @ApiOperation({ summary: 'Compare two student profiles side-by-side' })
  @ApiQuery({ name: 'a', required: true, type: String, description: 'First user id' })
  @ApiQuery({ name: 'b', required: true, type: String, description: 'Second user id' })
  @ApiResponse({ status: 200, type: ProfileComparisonResponseDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  async compareProfiles(
    @Query('a') a: string,
    @Query('b') b: string,
    @CurrentUser() viewer: AuthenticatedUser
  ): Promise<ProfileComparisonResponseDto> {
    if (!a || !b) {
      throw new BadRequestException('Both `a` and `b` query params are required');
    }
    if (a === b) {
      throw new BadRequestException('Cannot compare a profile with itself');
    }
    return this.userService.compareProfiles(a, b, viewer.sub);
  }

  @Get(':userId/profile')
  @ApiOperation({ summary: 'Get another user’s profile by ID' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  async getUserProfile(
    @Param('userId') userId: string,
    @CurrentUser() viewer: AuthenticatedUser
  ): Promise<UserProfileResponseDto> {
    return this.userService.getProfile(userId, viewer.sub);
  }
}
