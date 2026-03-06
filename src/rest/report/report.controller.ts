import { Controller, Post, Body, Get, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiCommonErrorResponses, ApiBadRequestResponse, ApiNotFoundResponse } from '@/rest/common';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportResponseDto } from './dto/report-response.dto';

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
  @ApiOperation({ summary: 'Get all reports' })
  @ApiResponse({ status: 200, type: [ReportResponseDto] })
  @ApiCommonErrorResponses()
  findAll(): Promise<ReportResponseDto[]> {
    return this.reportService.getAllReports();
  }

  @Get('user')
  @ApiOperation({ summary: "Get current user's submitted reports" })
  @ApiResponse({ status: 200, type: [ReportResponseDto] })
  @ApiCommonErrorResponses()
  findAllUserReports(@CurrentUser() user: AuthenticatedUser): Promise<ReportResponseDto[]> {
    return this.reportService.getReportsForUser(user.sub);
  }

  @Patch('status')
  @ApiOperation({ summary: 'Update a report status' })
  @ApiResponse({ status: 200, type: ReportResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  setReportStatus(@Body() dto: UpdateReportStatusDto): Promise<ReportResponseDto> {
    return this.reportService.updateStatus(dto.reportId, dto.status);
  }
}
