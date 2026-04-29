import { Controller, Post, Get, Param, Body, ForbiddenException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import {
  ZodValidationPipe,
  paginationSchema,
  type PaginationParams,
} from '@/rest/common/pagination';
import { EngagementService } from './engagement.service';
import { TrackEngagementDto } from './dto/track-engagement.dto';
import {
  EngagementCountResponseDto,
  EngagementEventResponseDto,
  PaginatedEngagementEventResponseDto,
} from './dto/engagement-event-response.dto';

@ApiTags('Engagement')
@ApiBearerAuth()
@Controller({ path: 'engagement', version: '1' })
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Post('track')
  @ApiOperation({ summary: 'Track an engagement event for the current user' })
  @ApiResponse({ status: 201, type: EngagementEventResponseDto })
  async trackEvent(
    @Body() dto: TrackEngagementDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<EngagementEventResponseDto> {
    const event = await this.engagementService.trackEvent(dto, user.sub);
    return {
      id: event.id,
      userId: event.userId,
      type: event.type,
      targetUserId: event.targetUserId,
      teamId: event.teamId,
      chatId: event.chatId,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt,
    };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: "List the current user's engagement events" })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: PaginatedEngagementEventResponseDto })
  async getUserEngagement(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams
  ): Promise<PaginatedEngagementEventResponseDto> {
    this.assertSelf(userId, user);
    return this.engagementService.getUserEngagement(userId, pagination);
  }

  @Get('profile-views/:userId')
  @ApiOperation({ summary: 'Count profile views for the current user' })
  @ApiResponse({ status: 200, type: EngagementCountResponseDto })
  async getProfileViews(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<EngagementCountResponseDto> {
    this.assertSelf(userId, user);
    return this.engagementService.getProfileViews(userId);
  }

  @Get('messages-sent/:userId')
  @ApiOperation({ summary: 'Count messages sent by the current user' })
  @ApiResponse({ status: 200, type: EngagementCountResponseDto })
  async getMessagesSent(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<EngagementCountResponseDto> {
    this.assertSelf(userId, user);
    return this.engagementService.getMessagesSent(userId);
  }

  private assertSelf(userId: string, user: AuthenticatedUser) {
    if (userId !== user.sub) {
      throw new ForbiddenException('Cannot read engagement for another user');
    }
  }
}
