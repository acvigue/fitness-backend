import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { ReportResponseDto } from './dto/report-response.dto';

@Injectable()
export class ReportService {
  async create(dto: ReportResponseDto, _userId: string): Promise<ReportResponseDto> {
    const reporter = await prisma.user.findUnique({ where: { id: dto.reporterId } });
    if (reporter == null) {
      throw new NotFoundException('Reporter not found');
    }

    const reported = await prisma.user.findUnique({ where: { id: dto.reportedId } });
    if (reported == null) {
      throw new NotFoundException('Reported user not found');
    }

    const report = await prisma.report.create({
      data: {
        userId1: dto.reporterId,
        userId2: dto.reportedId,
        reason: dto.reason,
        status: 'OPEN',
      },
    });

    return {
      reporterId: report.userId1,
      reportedId: report.userId2,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
    };
  }
}
