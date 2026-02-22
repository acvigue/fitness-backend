import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import { ApiCommonErrorResponses } from '@/rest/common';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user-response.dto';
import { UserMembershipResponseDto } from './dto/user-membership-response.dto';

@ApiTags('User')
@ApiBearerAuth()
@Controller({ path: 'user', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiCommonErrorResponses()
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): UserResponseDto {
    return this.userService.getProfile(user);
  }

  @Get('me/memberships')
  @ApiOperation({ summary: 'Get current user organization memberships' })
  @ApiResponse({ status: 200, type: [UserMembershipResponseDto] })
  @ApiCommonErrorResponses()
  getMemberships(@CurrentUser() user: AuthenticatedUser): Promise<UserMembershipResponseDto[]> {
    return this.userService.getMemberships(user.sub);
  }
}
