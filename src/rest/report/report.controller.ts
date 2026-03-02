import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {ReportResponseDto} from "./dto/report-reponse.dto"
import { CurrentUser } from '~/shared/current-user.decorator';
import type { AuthenticatedUser } from '~/rest/auth/oidc-auth.service';
import { ReportService } from './report.service';
import { UserService } from '~/rest/user/user.service';



@ApiTags('Report')
@ApiBearerAuth()
@Controller({ path: 'report', version: '1' })
export class ReportController {
  constructor(private readonly reportService: ReportService) {}
  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, type: ReportResponseDto })
  create(
    @Body() dto: ReportResponseDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ReportResponseDto> {
    return this.reportService.create(dto, user.sub);
  }
}