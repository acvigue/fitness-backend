import { Module } from '@nestjs/common';
import { NotificationModule } from '@/rest/notification/notification.module';
import { UserModule } from '@/rest/user/user.module';
import { AchievementModule } from '@/rest/achievement/achievement.module';
import { UserBlockModule } from '@/rest/user-block/user-block.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [NotificationModule, UserModule, AchievementModule, UserBlockModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
