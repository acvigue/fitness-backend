import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import {
  ApiCommonErrorResponses,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@/rest/common';
import {
  ZodValidationPipe,
  paginationSchema,
  type PaginationParams,
} from '@/rest/common/pagination';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  OrganizationResponseDto,
  PaginatedOrganizationResponseDto,
} from './dto/organization-response.dto';
import { OrganizationMemberResponseDto } from './dto/organization-member-response.dto';
import {
  PaginatedOrganizationMemberListDto,
  OrganizationMemberListItemDto,
  OrganizationMemberProfileResponseDto,
} from './dto/organization-member-detail-response.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { OrganizationInvitationResponseDto } from './dto/organization-invitation-response.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller({ path: 'organizations', version: '1' })
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, type: OrganizationResponseDto })
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationResponseDto> {
    return this.organizationService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: PaginatedOrganizationResponseDto })
  @ApiCommonErrorResponses()
  findAll(
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams
  ): Promise<PaginatedOrganizationResponseDto> {
    return this.organizationService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an organization by ID' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  findOne(@Param('id') id: string): Promise<OrganizationResponseDto> {
    return this.organizationService.findOne(id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List members of an organization' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: PaginatedOrganizationMemberListDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  getMembers(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams
  ): Promise<PaginatedOrganizationMemberListDto> {
    return this.organizationService.getMembers(id, pagination);
  }

  @Get(':id/members/:userId')
  @ApiOperation({ summary: 'Get full profile of an organization member' })
  @ApiResponse({ status: 200, type: OrganizationMemberProfileResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  getMemberProfile(
    @Param('id') id: string,
    @Param('userId') userId: string
  ): Promise<OrganizationMemberProfileResponseDto> {
    return this.organizationService.getMemberProfile(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization (STAFF or ADMIN only)' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationResponseDto> {
    return this.organizationService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an organization (ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Organization deleted' })
  @ApiForbiddenResponse('Insufficient role — requires ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.organizationService.delete(id, user.sub);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join an organization as MEMBER' })
  @ApiResponse({ status: 201, type: OrganizationMemberResponseDto })
  @ApiNotFoundResponse()
  @ApiResponse({ status: 409, description: 'Already a member' })
  @ApiCommonErrorResponses()
  join(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationMemberResponseDto> {
    return this.organizationService.join(id, user.sub);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave an organization' })
  @ApiResponse({ status: 204, description: 'Left the organization' })
  @ApiNotFoundResponse('Not a member of this organization')
  @ApiCommonErrorResponses()
  leave(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.organizationService.leave(id, user.sub);
  }

  // ─── Role administration (ADMIN only) ───────────────────

  @Patch(':id/members/:userId/role')
  @ApiOperation({ summary: 'Change a member’s role (ADMIN only)' })
  @ApiResponse({ status: 200, type: OrganizationMemberListItemDto })
  @ApiBadRequestResponse('Cannot demote the last admin')
  @ApiForbiddenResponse('Requires ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationMemberListItemDto> {
    return this.organizationService.updateMemberRole(id, userId, dto.role, user.sub);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from an organization (ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiBadRequestResponse('Cannot remove the last admin')
  @ApiForbiddenResponse('Requires ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.organizationService.removeMember(id, userId, user.sub);
  }

  // ─── Invitations ────────────────────────────────────────

  @Post(':id/invitations')
  @ApiOperation({ summary: 'Invite a user to join the organization (ADMIN only)' })
  @ApiResponse({ status: 201, type: OrganizationInvitationResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Requires ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  createInvitation(
    @Param('id') id: string,
    @Body() dto: CreateOrganizationInvitationDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationInvitationResponseDto> {
    return this.organizationService.createInvitation(id, dto.invitedUserId, dto.role, user.sub);
  }

  @Get(':id/invitations')
  @ApiOperation({ summary: 'List pending invitations for an organization (STAFF or ADMIN)' })
  @ApiResponse({ status: 200, type: [OrganizationInvitationResponseDto] })
  @ApiForbiddenResponse('Requires STAFF or ADMIN')
  @ApiCommonErrorResponses()
  listInvitations(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationInvitationResponseDto[]> {
    return this.organizationService.listInvitations(id, user.sub);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a pending invitation (ADMIN of the inviting org)' })
  @ApiResponse({ status: 204, description: 'Invitation revoked' })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  revokeInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.organizationService.revokeInvitation(invitationId, user.sub);
  }

  @Get('invitations/mine')
  @ApiOperation({ summary: 'List the authenticated user’s pending organization invitations' })
  @ApiResponse({ status: 200, type: [OrganizationInvitationResponseDto] })
  @ApiCommonErrorResponses()
  listMyInvitations(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationInvitationResponseDto[]> {
    return this.organizationService.listMyInvitations(user.sub);
  }

  @Patch('invitations/:invitationId/accept')
  @ApiOperation({ summary: 'Accept an organization invitation' })
  @ApiResponse({ status: 200, type: OrganizationInvitationResponseDto })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse('Invitation no longer pending')
  @ApiCommonErrorResponses()
  acceptInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationInvitationResponseDto> {
    return this.organizationService.respondToInvitation(invitationId, user.sub, true);
  }

  @Patch('invitations/:invitationId/decline')
  @ApiOperation({ summary: 'Decline an organization invitation' })
  @ApiResponse({ status: 200, type: OrganizationInvitationResponseDto })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse('Invitation no longer pending')
  @ApiCommonErrorResponses()
  declineInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationInvitationResponseDto> {
    return this.organizationService.respondToInvitation(invitationId, user.sub, false);
  }
}
