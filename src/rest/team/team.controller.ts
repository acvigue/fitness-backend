import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import {
  ApiBadRequestResponse,
  ApiCommonErrorResponses,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@/rest/common';
import { TeamService } from './team.service';
import { TeamCreateDto } from './dto/team-create.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { TeamUpdateCaptainDto } from './dto/team-update-captain.dto';
import { TeamUpdateDto } from './dto/team-update.dto';
import { TeamInviteDto } from './dto/team-invite.dto';
import { TeamInvitationResponseDto } from './dto/team-invitation-response.dto';
import { TeamMemberProfileResponseDto } from './dto/team-member-profile-response.dto';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller({ path: 'teams', version: '1' })
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @ApiOperation({ summary: 'Create a team and assign creator as captain' })
  @ApiResponse({ status: 201, type: TeamResponseDto })
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  create(
    @Body() dto: TeamCreateDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamResponseDto> {
    return this.teamService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List or search teams' })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Filter by team name (case-insensitive)',
  })
  @ApiQuery({ name: 'sportId', required: false, type: String, description: 'Filter by sport' })
  @ApiResponse({ status: 200, type: [TeamResponseDto] })
  @ApiCommonErrorResponses()
  findAll(@Query('q') q?: string, @Query('sportId') sportId?: string): Promise<TeamResponseDto[]> {
    return this.teamService.findAll({ q, sportId });
  }

  @Get('invitations/mine')
  @ApiOperation({ summary: 'List pending invitations for the current user' })
  @ApiResponse({ status: 200, type: [TeamInvitationResponseDto] })
  @ApiCommonErrorResponses()
  getUserInvitations(@CurrentUser() user: AuthenticatedUser): Promise<TeamInvitationResponseDto[]> {
    return this.teamService.getUserInvitations(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public team profile' })
  @ApiResponse({ status: 200, type: TeamResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  findOne(@Param('id') id: string): Promise<TeamResponseDto> {
    return this.teamService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update team settings (captain only)' })
  @ApiResponse({ status: 200, type: TeamResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('You are not the current team captain')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  update(
    @Param('id') id: string,
    @Body() dto: TeamUpdateDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamResponseDto> {
    return this.teamService.update(id, dto, user.sub);
  }

  @Patch(':id/captain')
  @ApiOperation({ summary: 'Change team captain (current captain only)' })
  @ApiResponse({ status: 200, type: TeamResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('You are not the current team captain')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  updateCaptain(
    @Param('id') id: string,
    @Body() dto: TeamUpdateCaptainDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamResponseDto> {
    return this.teamService.updateCaptain(id, dto, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a team (current captain only)' })
  @ApiResponse({
    status: 200,
    description: 'Team deleted',
    schema: {
      type: 'object',
      properties: {
        warning: {
          type: 'string',
          nullable: true,
          description: 'Warning if the team was in tournaments',
        },
      },
    },
  })
  @ApiForbiddenResponse('You are not the current team captain')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ warning?: string }> {
    return this.teamService.delete(id, user.sub);
  }

  // ─── Members ───────────────────────────────────────────

  @Get(':id/members/:userId')
  @ApiOperation({ summary: 'Get full profile of a team member' })
  @ApiResponse({ status: 200, type: TeamMemberProfileResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  getMemberProfile(
    @Param('id') id: string,
    @Param('userId') userId: string
  ): Promise<TeamMemberProfileResponseDto> {
    return this.teamService.getMemberProfile(id, userId);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a team (captain must transfer captaincy first)' })
  @ApiResponse({ status: 204, description: 'Left the team' })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  leaveTeam(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.teamService.leaveTeam(id, user.sub);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the team (captain only)' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Only the team captain can remove members')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  removeMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.teamService.removeMember(id, targetUserId, user.sub);
  }

  // ─── Invitations ───────────────────────────────────────

  @Post(':id/invitations')
  @ApiOperation({ summary: 'Send a team invitation to a user (captain only)' })
  @ApiResponse({ status: 201, type: TeamInvitationResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Only the team captain can send invitations')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  sendInvitation(
    @Param('id') id: string,
    @Body() dto: TeamInviteDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamInvitationResponseDto> {
    return this.teamService.sendInvitation(id, dto.userId, user.sub);
  }

  @Post(':id/requests')
  @ApiOperation({ summary: 'Request to join a team' })
  @ApiResponse({ status: 201, type: TeamInvitationResponseDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  requestToJoin(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamInvitationResponseDto> {
    return this.teamService.requestToJoin(id, user.sub);
  }

  @Get(':id/invitations')
  @ApiOperation({ summary: 'List pending invitations/requests for a team (captain only)' })
  @ApiResponse({ status: 200, type: [TeamInvitationResponseDto] })
  @ApiForbiddenResponse('Only the team captain can view team invitations')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  getTeamInvitations(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamInvitationResponseDto[]> {
    return this.teamService.getTeamInvitations(id, user.sub);
  }

  @Patch('invitations/:invitationId/accept')
  @ApiOperation({ summary: 'Accept an invitation or join request' })
  @ApiResponse({ status: 200, type: TeamInvitationResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  acceptInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamInvitationResponseDto> {
    return this.teamService.respondToInvitation(invitationId, user.sub, true);
  }

  @Patch('invitations/:invitationId/decline')
  @ApiOperation({ summary: 'Decline an invitation or join request' })
  @ApiResponse({ status: 200, type: TeamInvitationResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  declineInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamInvitationResponseDto> {
    return this.teamService.respondToInvitation(invitationId, user.sub, false);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a pending invitation (captain only)' })
  @ApiResponse({ status: 204, description: 'Invitation cancelled' })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Only the team captain can cancel invitations')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  cancelInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.teamService.cancelInvitation(invitationId, user.sub);
  }
}
