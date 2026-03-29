import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { AuthModule } from '@/rest/auth/auth.module';
import { NotificationModule } from '@/rest/notification/notification.module';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [TournamentController],
  providers: [TournamentService],
})
export class TournamentModule {}
