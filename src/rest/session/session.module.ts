import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { prisma } from '@/shared/utils';

@Module({
  providers: [SessionService, { provide: 'PRISMA', useValue: prisma }],
  controllers: [SessionController],
})
export class SessionsModule {}
