import { Controller, Post, Body, Get, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
  ApiCommonErrorResponses,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@/rest/common';
import {
  ZodValidationPipe,
  paginationSchema,
  type PaginationParams,
} from '@/rest/common/pagination';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportResponseDto, PaginatedReportResponseDto } from './dto/report-response.dto';

@ApiTags('Report')
@ApiBearerAuth()
@Controller({ path: 'report', version: '1' })
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new report' })
  @ApiResponse({ status: 201, type: ReportResponseDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  create(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ReportResponseDto> {
    return this.reportService.create(dto, user.sub);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all reports (organization admins only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: PaginatedReportResponseDto })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams
  ): Promise<PaginatedReportResponseDto> {
    return this.reportService.getAllReports(user.sub, pagination);
  }

  @Get('user')
  @ApiOperation({ summary: "Get current user's submitted reports" })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: PaginatedReportResponseDto })
  @ApiCommonErrorResponses()
  findAllUserReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams
  ): Promise<PaginatedReportResponseDto> {
    return this.reportService.getReportsForUser(user.sub, pagination);
  }

  @Patch('status')
  @ApiOperation({ summary: 'Update a report status (organization admins only)' })
  @ApiResponse({ status: 200, type: ReportResponseDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  setReportStatus(
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ReportResponseDto> {
    return this.reportService.updateStatus(dto.reportId, dto.status, user.sub);
  }
}
