import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { StatusOnReport } from '../../generated/prisma/enums';
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

    const duplicate = await prisma.report.findUnique({
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      where: { AND: [{ userId1: dto.reporterId }, { userId2: dto.reportedId }] },
    });
    if (duplicate != null) {
      throw new Error('Repeated Report from Reporter towards Reported');
    }

    const reportCopy = await prisma.report.create({
      data: {
        userId1: dto.reporterId,
        userId2: dto.reportedId,
        reason: dto.reason,
        status: 'PENDING',
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
  async getReportsForUser(_userId: string): Promise<ReportResponseDto[]> {
    const reports = await prisma.report.findMany({ where: { userId1: _userId } });
    return reports.map((m) => ({
      reporterId: m.userId1,
      reportedId: m.userId2,
      reason: m.reason,
      status: m.status,
      createdAt: m.createdAt,
    }));
  }
  async updateStatus(
    userId1: string,
    userId2: string,
    statusString: string
  ): Promise<ReportResponseDto> {
    let newStatus = null;
    if (statusString === 'PENDING') {
      newStatus = StatusOnReport.PENDING;
    } else if (statusString === 'REVIEWED') {
      newStatus = StatusOnReport.PENDING;
    } else if (statusString === 'RESOLVED') {
      newStatus = StatusOnReport.PENDING;
    } else if (statusString === 'DISMISSED') {
      newStatus = StatusOnReport.PENDING;
    } else {
      throw Error('Invalid Input');
    }
    const updateReport = await prisma.report.update({
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      where: { AND: [{ userId1: userId1 }, { userId2: userId2 }] },
      data: { status: newStatus },
    });
    return {
      reporterId: updateReport.userId1,
      reportedId: updateReport.userId2,
      reason: updateReport.reason,
      status: updateReport.status,
      createdAt: updateReport.createdAt,
    };
  }
}
