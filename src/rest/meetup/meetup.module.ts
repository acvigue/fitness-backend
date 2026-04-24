import { Module } from '@nestjs/common';
import { TeamBlockModule } from '@/rest/team-block/team-block.module';
import { NotificationModule } from '@/rest/notification/notification.module';
import { EngagementModule } from '@/rest/engagement/engagement.module';
import { MeetupController } from './meetup.controller';
import { MeetupService } from './meetup.service';

@Module({
  imports: [TeamBlockModule, NotificationModule, EngagementModule],
  controllers: [MeetupController],
  providers: [MeetupService],
})
export class MeetupModule {}
