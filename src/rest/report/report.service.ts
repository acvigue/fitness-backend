import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { StatusOnReport } from '@/generated/prisma/enums';
import type { CreateReportDto } from './dto/create-report.dto';
import type { ReportResponseDto } from './dto/report-response.dto';

type ReportRecord = {
  id: string;
  userId1: string;
  userId2: string;
  messageId: string | null;
  reason: string | null;
  status: StatusOnReport;
  createdAt: Date;
};

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

    if (dto.messageId) {
      const message = await prisma.message.findUnique({
        where: { id: dto.messageId },
        select: { id: true, senderId: true },
      });
      if (!message) {
        throw new NotFoundException('Reported message not found');
      }
      if (message.senderId !== dto.reportedId) {
        throw new BadRequestException('Message was not sent by the reported user');
      }

      const dupMsg = await prisma.report.findFirst({
        where: { userId1: userId, messageId: dto.messageId },
      });
      if (dupMsg) {
        throw new BadRequestException('You have already reported this message');
      }
    } else {
      const dupUser = await prisma.report.findFirst({
        where: { userId1: userId, userId2: dto.reportedId, messageId: null },
      });
      if (dupUser) {
        throw new BadRequestException('You have already reported this user');
      }
    }

    const report = await prisma.report.create({
      data: {
        userId1: userId,
        userId2: dto.reportedId,
        messageId: dto.messageId ?? null,
        reason: dto.reason ?? null,
        status: 'PENDING',
      },
    });

    return this.toResponse(report);
  }

  async getAllReports(requesterId: string): Promise<ReportResponseDto[]> {
    await this.ensureOrgAdmin(requesterId);

    const reports = await prisma.report.findMany({ orderBy: { createdAt: 'desc' } });
    return reports.map((r) => this.toResponse(r));
  }

  private async ensureOrgAdmin(userId: string) {
    const adminMembership = await prisma.organizationMember.findFirst({
      where: { userId, role: 'ADMIN' },
      select: { id: true },
    });

    if (!adminMembership) {
      throw new ForbiddenException('Only organization admins can perform this action');
    }
  }

  async getReportsForUser(userId: string): Promise<ReportResponseDto[]> {
    const reports = await prisma.report.findMany({
      where: { userId1: userId },
      orderBy: { createdAt: 'desc' },
    });
    return reports.map((r) => this.toResponse(r));
  }

  async updateStatus(
    reportId: string,
    status: StatusOnReport,
    requesterId: string
  ): Promise<ReportResponseDto> {
    await this.ensureOrgAdmin(requesterId);

    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status },
    });

    return this.toResponse(updated);
  }

  private toResponse(r: ReportRecord): ReportResponseDto {
    return {
      id: r.id,
      reporterId: r.userId1,
      reportedId: r.userId2,
      messageId: r.messageId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
    };
  }
}
