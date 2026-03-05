import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import { ApiCommonErrorResponses, ApiBadRequestResponse, ApiNotFoundResponse } from '@/rest/common';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user-response.dto';
import { UserMembershipResponseDto } from './dto/user-membership-response.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { KeycloakSessionResponseDto } from './dto/keycloak-session-response.dto';
import { RevokeSessionsResponseDto } from './dto/revoke-sessions-response.dto';
import { UserLookupQueryDto } from './dto/user-lookup-query.dto';
import { UserLookupResponseDto } from './dto/user-lookup-response.dto';
import { EnrichSessionDto, EnrichSessionResponseDto } from './dto/enrich-session.dto';
import { DeactivateAccountResponseDto } from './dto/deactivate-account-response.dto';
import { DeleteAccountResponseDto } from './dto/delete-account-response.dto';
import { Body, Patch } from '@nestjs/common';

@ApiTags('User')
@ApiBearerAuth()
@Controller({ path: 'user', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('lookup')
  @ApiOperation({ summary: 'Search users by email, name, or username' })
  @ApiResponse({ status: 200, type: UserLookupResponseDto })
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  lookupUsers(
    @Query() query: UserLookupQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<UserLookupResponseDto> {
    return this.userService.lookupUsers(query.q, user.sub);
  }

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
    @Body() dto: UpdateUserProfileDto
  ): Promise<UserProfileResponseDto> {
    return this.userService.updateProfile(user.sub, dto);
  }

  @Post('sessions/enrich')
  @ApiOperation({
    summary: 'Store refresh token for the current session to enable offline session revocation',
  })
  @ApiResponse({ status: 201, type: EnrichSessionResponseDto })
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  enrichSession(
    @Body() dto: EnrichSessionDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<EnrichSessionResponseDto> {
    const sessionId = user.payload.sid as string | undefined;
    if (!sessionId) {
      throw new BadRequestException('No session ID (sid) found in access token');
    }
    return this.userService.enrichSession(sessionId, dto.refreshToken);
  }

  @Get('sessions')
  @ApiOperation({ summary: "List current user's identity provider sessions" })
  @ApiResponse({ status: 200, type: [KeycloakSessionResponseDto] })
  @ApiCommonErrorResponses()
  getSessions(@CurrentUser() user: AuthenticatedUser): Promise<KeycloakSessionResponseDto[]> {
    return this.userService.getSessions(user.sub, user.payload.sid as string | undefined);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a specific identity provider session' })
  @ApiResponse({ status: 204, description: 'Session revoked' })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  revokeSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.userService.revokeSession(sessionId, user.sub);
  }

  @Post('sessions/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke all of the current user's identity provider sessions" })
  @ApiResponse({ status: 200, type: RevokeSessionsResponseDto })
  @ApiCommonErrorResponses()
  revokeAllSessions(@CurrentUser() user: AuthenticatedUser): Promise<RevokeSessionsResponseDto> {
    return this.userService.revokeAllSessions(user.sub);
  }

  @Post('me/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate current user account' })
  @ApiResponse({ status: 200, type: DeactivateAccountResponseDto })
  @ApiCommonErrorResponses()
  deactivateAccount(@CurrentUser() user: AuthenticatedUser): Promise<DeactivateAccountResponseDto> {
    return this.userService.deactivateAccount(user.sub);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete current user account' })
  @ApiResponse({ status: 200, type: DeleteAccountResponseDto })
  @ApiCommonErrorResponses()
  deleteAccount(@CurrentUser() user: AuthenticatedUser): Promise<DeleteAccountResponseDto> {
    return this.userService.deleteAccount(user.sub);
  }
}
