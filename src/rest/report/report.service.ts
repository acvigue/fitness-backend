import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { PaginationParams } from '@/rest/common/pagination';
import { paginate, type PaginatedResult } from '@/rest/common/pagination';
import type { ReportResponseDto } from './dto/report-reponse.dto'
import type { CreateOrganizationDto } from '~/rest/organization/dto/create-organization.dto';
@Injectable()
export class OrganizationService {
  async create(dto: ReportResponseDto, userId: string): Promise<ReportResponseDto> {
    return prisma.$transaction(async (tx) => {
      const reporter = await prisma.user.findUnique({ where: { id: dto.reportedId } })
      if (reporter == null) {
        throw new Error()
      }
      const reporterName = reporter.name
      if (reporterName == null) {
        throw new Error()
      }
      const reported = await prisma.user.findUnique({ where: { id: dto.reportedId } })
      if (reported == null) {
        throw new Error()
      }
      const reportedName = reported.name
      const report = tx.report.create({
        data: {
          reporter: reporter,
          reportedUser: reportedName,
          reason: dto.reason,
          status: dto.status,
          createdAt: dto.status
        }
      });
      return {
        reporter: report.reporter,
        reportedUser: report.reportedUser,
        reason: report.reason,
        status: report.status,
        createAt: report.createdAt,
      };
    });
  };

}