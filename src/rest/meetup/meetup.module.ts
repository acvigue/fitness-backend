import { Module } from '@nestjs/common';
import { TeamBlockModule } from '@/rest/team-block/team-block.module';
import { NotificationModule } from '@/rest/notification/notification.module';
import { MeetupController } from './meetup.controller';
import { MeetupService } from './meetup.service';

@Module({
  imports: [TeamBlockModule, NotificationModule],
  controllers: [MeetupController],
  providers: [MeetupService],
})
export class MeetupModule {}
