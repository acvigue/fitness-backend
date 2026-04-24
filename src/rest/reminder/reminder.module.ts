import { Module } from '@nestjs/common';
import { NotificationModule } from '@/rest/notification/notification.module';
import { ReminderController } from './reminder.controller';
import { ReminderService } from './reminder.service';

@Module({
  imports: [NotificationModule],
  controllers: [ReminderController],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule {}
