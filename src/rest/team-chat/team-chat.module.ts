import { Module } from '@nestjs/common';
import { ChatModule } from '@/rest/chat/chat.module';
import { TeamBlockModule } from '@/rest/team-block/team-block.module';
import { NotificationModule } from '@/rest/notification/notification.module';
import { EngagementModule } from '@/rest/engagement/engagement.module';
import { TeamChatController } from './team-chat.controller';
import { TeamChatService } from './team-chat.service';

@Module({
  imports: [ChatModule, TeamBlockModule, NotificationModule, EngagementModule],
  controllers: [TeamChatController],
  providers: [TeamChatService],
})
export class TeamChatModule {}
