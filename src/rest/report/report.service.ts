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

    const reportCopy = await prisma.report.create({
      data: {
        userId1: dto.reporterId,
        userId2: dto.reportedId,
        reason: dto.reason,
        status: 'OPEN',
      },
    });

    return {
      reporterId: reportCopy.userId1,
      reportedId: reportCopy.userId2,
      reason: reportCopy.reason,
      status: reportCopy.status,
      createdAt: reportCopy.createdAt,
    };
  }
  async getAllReports(): Promise<ReportResponseDto[]> {
    const reports = await prisma.report.findMany();
    return reports.map((m) => ({
      reporterId: m.userId1,
      reportedId: m.userId2,
      reason: m.reason,
      status: m.status,
      createdAt: m.createdAt,
    }));
  }
}
