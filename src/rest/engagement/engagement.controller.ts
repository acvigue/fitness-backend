import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { EngagementService } from './engagement.service';
import { TrackEngagementDto } from './dto/track-engagement.dto';

@Controller('engagement')
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Post('track')
  async trackEvent(@Body() dto: TrackEngagementDto) {
    return this.engagementService.trackEvent(dto);
  }

  @Get('user/:userId')
  async getUserEngagement(@Param('userId') userId: string) {
    return this.engagementService.getUserEngagement(userId);
  }

  @Get('profile-views/:userId')
  async getProfileViews(@Param('userId') userId: string) {
    return this.engagementService.getProfileViews(userId);
  }

  @Get('messages-sent/:userId')
  async getMessagesSent(@Param('userId') userId: string) {
    return this.engagementService.getMessagesSent(userId);
  }
}
