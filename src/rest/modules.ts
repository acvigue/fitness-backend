import { HealthModule } from '@/rest/health/health.module';
import { OrganizationModule } from '@/rest/organization/organization.module';
import { ReportModule } from '@/rest/report/report.module';
import { UserModule } from '@/rest/user/user.module';

export const restFeatureModules = [
  HealthModule,
  OrganizationModule,
  ReportModule,
  UserModule,
] as const;
