import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import { ApiCommonErrorResponses } from '@/rest/common';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user-response.dto';
import { UserMembershipResponseDto } from './dto/user-membership-response.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfilePictureDto, UserProfileResponseDto } from './dto/user-profile-response.dto';
import { Body, Patch } from '@nestjs/common';

@ApiTags('User')
@ApiBearerAuth()
@Controller({ path: 'user', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiCommonErrorResponses()
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return this.userService.getOrCreateMe(user);
  }

  @Get('me/memberships')
  @ApiOperation({ summary: 'Get current user organization memberships' })
  @ApiResponse({ status: 200, type: [UserMembershipResponseDto] })
  @ApiCommonErrorResponses()
  getMemberships(@CurrentUser() user: AuthenticatedUser): Promise<UserMembershipResponseDto[]> {
    return this.userService.getMemberships(user.sub);
  }



  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileResponseDto> {
    return this.userService.getProfile(user.sub);
  }
  
  @Patch('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    return this.userService.updateProfile(user.sub, dto);
  }


}
