import { Module } from '@nestjs/common';
import { NotificationModule } from '@/rest/notification/notification.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [NotificationModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
