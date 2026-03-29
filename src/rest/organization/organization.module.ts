import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { AuthModule } from '@/rest/auth/auth.module';
import { UserModule } from '@/rest/user/user.module';

@Module({
  imports: [AuthModule, UserModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
