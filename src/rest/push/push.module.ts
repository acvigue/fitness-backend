import { Module } from '@nestjs/common';
import { ApnsProvider } from './apns.provider';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { WebPushProvider } from './webpush.provider';

@Module({
  controllers: [PushController],
  providers: [ApnsProvider, WebPushProvider, PushService],
  exports: [PushService],
})
export class PushModule {}
