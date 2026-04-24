import { Module } from '@nestjs/common';
import { AchievementModule } from '@/rest/achievement/achievement.module';
import { EngagementService } from './engagement.service';
import { EngagementController } from './engagement.controller';

@Module({
  imports: [AchievementModule],
  controllers: [EngagementController],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
