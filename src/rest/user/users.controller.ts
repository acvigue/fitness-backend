import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { ApiCommonErrorResponses, ApiNotFoundResponse } from '@/rest/common';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly userService: UserService) {}

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
