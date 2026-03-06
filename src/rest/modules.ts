import { ChatModule } from '@/rest/chat/chat.module';
import { HealthModule } from '@/rest/health/health.module';
import { OrganizationModule } from '@/rest/organization/organization.module';
import { ReportModule } from '@/rest/report/report.module';
import { SportModule } from '@/rest/sport/sport.module';
import { UserModule } from '@/rest/user/user.module';
import { UtilsModule } from '@/rest/utils/utils.module';
import { SessionsModule } from '@/rest/session/session.module';

export const restFeatureModules = [
  ChatModule,
  HealthModule,
  OrganizationModule,
  ReportModule,
  SportModule,
  UserModule,
  UtilsModule,
  SessionsModule,
] as const;
