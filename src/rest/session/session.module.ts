import { Module } from '@nestjs/common';
import { AuthModule } from '@/rest/auth/auth.module';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { prisma } from '@/shared/utils';

@Module({
  imports: [AuthModule],
  providers: [SessionService, { provide: 'PRISMA', useValue: prisma }],
  controllers: [SessionController],
})
export class SessionsModule {}
