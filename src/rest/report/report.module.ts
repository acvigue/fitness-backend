import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { AuthModule } from '@/rest/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
