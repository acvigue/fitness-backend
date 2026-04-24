import { Module } from '@nestjs/common';
import { UserBlockController } from './user-block.controller';
import { UserBlockService } from './user-block.service';

@Module({
  controllers: [UserBlockController],
  providers: [UserBlockService],
  exports: [UserBlockService],
})
export class UserBlockModule {}
