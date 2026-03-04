import { Module } from '@nestjs/common';
import { UserController } from '@/rest/user/user.controller';
import { UserService } from '@/rest/user/user.service';
import { KeycloakAdminService } from '@/rest/user/keycloak-admin.service';
import { AuthModule } from '@/rest/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService, KeycloakAdminService],
  exports: [KeycloakAdminService],
})
export class UserModule {}
