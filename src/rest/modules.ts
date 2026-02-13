import { HealthModule } from '@/rest/health/health.module';
import { UserModule } from '@/rest/user/user.module';

export const restFeatureModules = [HealthModule, UserModule] as const;
