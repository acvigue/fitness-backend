import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { ApiCommonErrorResponses, ApiForbiddenResponse, ApiNotFoundResponse } from '@/rest/common';
import { BroadcastService } from './broadcast.service';
import {
  BroadcastResponseDto,
  BroadcastStatsResponseDto,
  CreateBroadcastDto,
} from './dto/broadcast.dto';

@ApiTags('Broadcasts')
@ApiBearerAuth()
@Controller({ version: '1' })
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Post('teams/:teamId/broadcasts')
  @ApiOperation({ summary: 'Send a broadcast to all team members (captain only)' })
  @ApiResponse({ status: 201, type: BroadcastResponseDto })
  @ApiForbiddenResponse('Only team captains can broadcast')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  broadcast(
    @Param('teamId') teamId: string,
    @Body() dto: CreateBroadcastDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<BroadcastResponseDto> {
    return this.broadcastService.broadcast(teamId, dto, user.sub);
  }

  @Get('teams/:teamId/broadcasts')
  @ApiOperation({ summary: 'List broadcasts for a team (members only)' })
  @ApiResponse({ status: 200, type: [BroadcastResponseDto] })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  listForTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<BroadcastResponseDto[]> {
    return this.broadcastService.listForTeam(teamId, user.sub);
  }

  @Post('broadcasts/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a broadcast as read' })
  @ApiResponse({ status: 204, description: 'Broadcast marked as read' })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  markRead(
    @Param('id') broadcastId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.broadcastService.markRead(broadcastId, user.sub);
  }

  @Get('broadcasts/:id/stats')
  @ApiOperation({ summary: 'Get delivery and read stats for a broadcast (captain only)' })
  @ApiResponse({ status: 200, type: BroadcastStatsResponseDto })
  @ApiForbiddenResponse('Only the team captain can view stats')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  getStats(
    @Param('id') broadcastId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<BroadcastStatsResponseDto> {
    return this.broadcastService.getStats(broadcastId, user.sub);
  }
}
