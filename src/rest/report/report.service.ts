import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { StatusOnReport } from '@/generated/prisma/enums';
import type { CreateReportDto } from './dto/create-report.dto';
import type { ReportResponseDto } from './dto/report-response.dto';

@Injectable()
export class ReportService {
  async create(dto: CreateReportDto, userId: string): Promise<ReportResponseDto> {
    if (dto.reportedId === userId) {
      throw new BadRequestException('You cannot report yourself');
    }

    const reported = await prisma.user.findUnique({ where: { id: dto.reportedId } });
    if (!reported) {
      throw new NotFoundException('Reported user not found');
    }

    const duplicate = await prisma.report.findFirst({
      where: { userId1: userId, userId2: dto.reportedId },
    });
    if (duplicate) {
      throw new BadRequestException('You have already reported this user');
    }

    const report = await prisma.report.create({
      data: {
        userId1: userId,
        userId2: dto.reportedId,
        reason: dto.reason ?? null,
        status: 'PENDING',
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

  async getAllReports(): Promise<ReportResponseDto[]> {
    const reports = await prisma.report.findMany({ orderBy: { createdAt: 'desc' } });
    return reports.map((r) => ({
      reporterId: r.userId1,
      reportedId: r.userId2,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async getReportsForUser(userId: string): Promise<ReportResponseDto[]> {
    const reports = await prisma.report.findMany({
      where: { userId1: userId },
      orderBy: { createdAt: 'desc' },
    });
    return reports.map((r) => ({
      reporterId: r.userId1,
      reportedId: r.userId2,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async updateStatus(reportId: string, status: StatusOnReport): Promise<ReportResponseDto> {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status },
    });

    return {
      reporterId: updated.userId1,
      reportedId: updated.userId2,
      reason: updated.reason,
      status: updated.status,
      createdAt: updated.createdAt,
    };
  }
}
