import { Module } from '@nestjs/common';
import { GymController } from './gym.controller';
import { GymService } from './gym.service';
import { PrismaService } from '@/prisma/prisma.service';

@Module({
  controllers: [GymController],
  providers: [GymService, PrismaService],
  exports: [GymService],
})
export class GymModule {}
