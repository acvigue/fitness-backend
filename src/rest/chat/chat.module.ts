import { Module } from '@nestjs/common';
import { AuthModule } from '@/rest/auth/auth.module';
import { UserBlockModule } from '@/rest/user-block/user-block.module';
import { EngagementModule } from '@/rest/engagement/engagement.module';
import { ModerationModule } from '@/rest/moderation/moderation.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule, UserBlockModule, EngagementModule, ModerationModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
