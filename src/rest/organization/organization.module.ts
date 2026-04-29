import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { AuthModule } from '@/rest/auth/auth.module';
import { UserModule } from '@/rest/user/user.module';
import { AchievementModule } from '@/rest/achievement/achievement.module';
import { AuditModule } from '@/rest/audit/audit.module';
import { NotificationModule } from '@/rest/notification/notification.module';

@Module({
  imports: [AuthModule, UserModule, AchievementModule, AuditModule, NotificationModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
