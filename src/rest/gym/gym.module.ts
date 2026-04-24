import { Module } from '@nestjs/common';
import { GymController } from './gym.controller';
import { GymService } from './gym.service';
import { GymSubscriptionService } from './gym-subscription.service';
import { NotificationModule } from '@/rest/notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [GymController],
  providers: [GymService, GymSubscriptionService],
  exports: [GymService, GymSubscriptionService],
})
export class GymModule {}
