import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { AuthModule } from '@/rest/auth/auth.module';
import { NotificationModule } from '@/rest/notification/notification.module';
import { AchievementModule } from '@/rest/achievement/achievement.module';
import { ModerationModule } from '@/rest/moderation/moderation.module';

@Module({
  imports: [AuthModule, NotificationModule, AchievementModule, ModerationModule],
  controllers: [TournamentController],
  providers: [TournamentService],
})
export class TournamentModule {}
