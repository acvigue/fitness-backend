import { Module } from '@nestjs/common';
import { NotificationModule } from '@/rest/notification/notification.module';
import { UserModule } from '@/rest/user/user.module';
import { AchievementModule } from '@/rest/achievement/achievement.module';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

@Module({
  imports: [NotificationModule, UserModule, AchievementModule],
  controllers: [VideoController],
  providers: [VideoService],
})
export class VideoModule {}
