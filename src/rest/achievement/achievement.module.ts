import { Module } from '@nestjs/common';
import { AchievementController } from './achievement.controller';
import { AchievementService } from './achievement.service';
import { AuthModule } from '@/rest/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AchievementController],
  providers: [AchievementService],
})
export class AchievementModule {}
