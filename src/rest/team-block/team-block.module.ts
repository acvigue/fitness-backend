import { Module } from '@nestjs/common';
import { TeamBlockController } from './team-block.controller';
import { TeamBlockService } from './team-block.service';

@Module({
  controllers: [TeamBlockController],
  providers: [TeamBlockService],
  exports: [TeamBlockService],
})
export class TeamBlockModule {}
