import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MeetupStatus } from '@/generated/prisma/enums';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import {
  ApiCommonErrorResponses,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
} from '@/rest/common';
import {
  ZodValidationPipe,
  paginationSchema,
  type PaginationParams,
} from '@/rest/common/pagination';
import { MeetupService } from './meetup.service';
import { CreateMeetupDto } from './dto/create-meetup.dto';
import { MeetupResponseDto, PaginatedMeetupResponseDto } from './dto/meetup-response.dto';

@ApiTags('Meetups')
@ApiBearerAuth()
@Controller({ path: 'meetups', version: '1' })
export class MeetupController {
  constructor(private readonly meetupService: MeetupService) {}

  @Post()
  @ApiOperation({ summary: 'Propose a meetup with another team' })
  @ApiResponse({ status: 201, type: MeetupResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  proposeMeetup(
    @Body() dto: CreateMeetupDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MeetupResponseDto> {
    return this.meetupService.proposeMeetup(dto, user.sub);
  }

  @Get('team/:teamId')
  @ApiOperation({ summary: 'List meetups for a team (optionally filter by status)' })
  @ApiQuery({ name: 'status', required: false, enum: MeetupStatus })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: PaginatedMeetupResponseDto })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  getTeamMeetups(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams,
    @Query('status') status?: keyof typeof MeetupStatus
  ): Promise<PaginatedMeetupResponseDto> {
    return this.meetupService.getTeamMeetups(teamId, user.sub, pagination, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get meetup details' })
  @ApiResponse({ status: 200, type: MeetupResponseDto })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  getMeetup(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MeetupResponseDto> {
    return this.meetupService.getMeetup(id, user.sub);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accept a meetup proposal (receiving team captain only)' })
  @ApiResponse({ status: 200, type: MeetupResponseDto })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  acceptMeetup(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MeetupResponseDto> {
    return this.meetupService.acceptMeetup(id, user.sub);
  }

  @Patch(':id/decline')
  @ApiOperation({ summary: 'Decline a meetup proposal (receiving team captain only)' })
  @ApiResponse({ status: 200, type: MeetupResponseDto })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  declineMeetup(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MeetupResponseDto> {
    return this.meetupService.declineMeetup(id, user.sub);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a meetup (proposing team captain only)' })
  @ApiResponse({ status: 200, type: MeetupResponseDto })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  cancelMeetup(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MeetupResponseDto> {
    return this.meetupService.cancelMeetup(id, user.sub);
  }
}
