import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { ApiCommonErrorResponses, ApiNotFoundResponse } from '@/rest/common';
import { UserBlockService, type UserBlockResponse } from './user-block.service';

@ApiTags('User Blocks')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UserBlockController {
  constructor(private readonly userBlockService: UserBlockService) {}

  @Post(':userId/block')
  @ApiOperation({ summary: 'Block a user' })
  @ApiResponse({ status: 201, description: 'User blocked' })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  block(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<UserBlockResponse> {
    return this.userBlockService.block(user.sub, userId);
  }

  @Delete(':userId/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unblock a previously blocked user' })
  @ApiResponse({ status: 204, description: 'User unblocked' })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  unblock(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.userBlockService.unblock(user.sub, userId);
  }

  @Get('me/blocks')
  @ApiOperation({ summary: 'List users the current user has blocked' })
  @ApiCommonErrorResponses()
  listMyBlocks(@CurrentUser() user: AuthenticatedUser): Promise<UserBlockResponse[]> {
    return this.userBlockService.listBlocks(user.sub);
  }
}
