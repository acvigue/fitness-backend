import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import { ApiCommonErrorResponses, ApiForbiddenResponse } from '@/rest/common';
import { TeamBlockService } from './team-block.service';
import { CreateTeamBlockDto } from './dto/create-team-block.dto';
import { TeamBlockResponseDto } from './dto/team-block-response.dto';

@ApiTags('Team Blocks')
@ApiBearerAuth()
@Controller({ path: 'teams/:teamId/blocks', version: '1' })
export class TeamBlockController {
  constructor(private readonly teamBlockService: TeamBlockService) {}

  @Post()
  @ApiOperation({ summary: 'Block a team from messaging (captain only)' })
  @ApiResponse({ status: 201, type: TeamBlockResponseDto })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  blockTeam(
    @Param('teamId') teamId: string,
    @Body() dto: CreateTeamBlockDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamBlockResponseDto> {
    return this.teamBlockService.blockTeam(teamId, dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List blocked teams (captain only)' })
  @ApiResponse({ status: 200, type: [TeamBlockResponseDto] })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  getBlockedTeams(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamBlockResponseDto[]> {
    return this.teamBlockService.getBlockedTeams(teamId, user.sub);
  }

  @Delete(':blockedTeamId')
  @ApiOperation({ summary: 'Unblock a team (captain only)' })
  @ApiResponse({ status: 200 })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  unblockTeam(
    @Param('teamId') teamId: string,
    @Param('blockedTeamId') blockedTeamId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.teamBlockService.unblockTeam(teamId, blockedTeamId, user.sub);
  }
}
