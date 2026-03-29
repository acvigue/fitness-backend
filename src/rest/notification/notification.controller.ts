import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import { ApiCommonErrorResponses, ApiNotFoundResponse } from '@/rest/common';
import { NotificationService } from './notification.service';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List all notifications for the current user' })
  @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  @ApiCommonErrorResponses()
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<NotificationResponseDto[]> {
    return this.notificationService.findAll(user.sub);
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
}
