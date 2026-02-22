import { HealthModule } from '@/rest/health/health.module';
import { OrganizationModule } from '@/rest/organization/organization.module';
import { UserModule } from '@/rest/user/user.module';

export const restFeatureModules = [HealthModule, OrganizationModule, UserModule] as const;
