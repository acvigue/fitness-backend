import { Module } from '@nestjs/common';
import { AuthModule } from '@/rest/auth/auth.module';
import { UserBlockModule } from '@/rest/user-block/user-block.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule, UserBlockModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
