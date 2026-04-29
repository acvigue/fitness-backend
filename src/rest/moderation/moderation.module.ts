import { Module } from '@nestjs/common';
import { AuditModule } from '@/rest/audit/audit.module';
import { NotificationModule } from '@/rest/notification/notification.module';
import { ModerationController } from './moderation.controller';
import { SuspensionAppealController } from './suspension-appeal.controller';
import { ModerationService } from './moderation.service';

@Module({
  imports: [AuditModule, NotificationModule],
  controllers: [ModerationController, SuspensionAppealController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
