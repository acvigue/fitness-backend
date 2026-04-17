import { Module } from '@nestjs/common';
import { NotificationModule } from '@/rest/notification/notification.module';
import { UserModule } from '@/rest/user/user.module';
import { AchievementModule } from '@/rest/achievement/achievement.module';
import { VideoController } from './team.controller';
import { VideoService } from './team.service';

@Module({
  imports: [NotificationModule, UserModule, AchievementModule],
  controllers: [VideoController],
  providers: [VideoService],
})
export class VideoModule {}
