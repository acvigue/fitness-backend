import { Module } from '@nestjs/common';
import { UserController } from '@/rest/user/user.controller';
import { UserService } from '@/rest/user/user.service';
import { AuthModule } from '@/rest/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
