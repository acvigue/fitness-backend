import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import { ApiCommonErrorResponses, ApiNotFoundResponse } from '@/rest/common';
import {
  ZodValidationPipe,
  paginationSchema,
  type PaginationParams,
} from '@/rest/common/pagination';
import { NotificationService } from './notification.service';
import {
  NotificationResponseDto,
  PaginatedNotificationResponseDto,
} from './dto/notification-response.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List all notifications for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: PaginatedNotificationResponseDto })
  @ApiCommonErrorResponses()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams
  ): Promise<PaginatedNotificationResponseDto> {
    return this.notificationService.findAll(user.sub, pagination);
  }

  @Patch(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss a notification' })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  dismiss(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<NotificationResponseDto> {
    return this.notificationService.dismiss(id, user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<NotificationResponseDto> {
    return this.notificationService.markRead(id, user.sub);
  }
}
