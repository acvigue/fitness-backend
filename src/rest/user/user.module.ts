import { Module } from '@nestjs/common';
import { UserController } from '@/rest/user/user.controller';
import { UsersController } from '@/rest/user/users.controller';
import { UserService } from '@/rest/user/user.service';
import { KeycloakAdminService } from '@/rest/user/keycloak-admin.service';
import { AuthModule } from '@/rest/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserController, UsersController],
  providers: [UserService, KeycloakAdminService],
  exports: [UserService, KeycloakAdminService],
})
export class UserModule {}
