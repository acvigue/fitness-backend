import { Controller, Post, Get, Param, Body, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { EngagementService } from './engagement.service';
import { TrackEngagementDto } from './dto/track-engagement.dto';

@ApiTags('Engagement')
@ApiBearerAuth()
@Controller({ path: 'engagement', version: '1' })
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Post('track')
  async trackEvent(@Body() dto: TrackEngagementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.engagementService.trackEvent(dto, user.sub);
  }

  @Get('user/:userId')
  async getUserEngagement(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertSelf(userId, user);
    return this.engagementService.getUserEngagement(userId);
  }

  @Get('profile-views/:userId')
  async getProfileViews(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertSelf(userId, user);
    return this.engagementService.getProfileViews(userId);
  }

  @Get('messages-sent/:userId')
  async getMessagesSent(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertSelf(userId, user);
    return this.engagementService.getMessagesSent(userId);
  }

  private assertSelf(userId: string, user: AuthenticatedUser) {
    if (userId !== user.sub) {
      throw new ForbiddenException('Cannot read engagement for another user');
    }
  }
}
