import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { ApiCommonErrorResponses } from '@/rest/common';
import { ReminderService } from './reminder.service';
import {
  ReminderPreferenceResponseDto,
  UpdateReminderPreferenceDto,
} from './dto/reminder-preferences.dto';

@ApiTags('Reminders')
@ApiBearerAuth()
@Controller({ path: 'reminders', version: '1' })
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'List the current user’s reminder preferences' })
  @ApiResponse({ status: 200, type: [ReminderPreferenceResponseDto] })
  @ApiCommonErrorResponses()
  list(@CurrentUser() user: AuthenticatedUser): Promise<ReminderPreferenceResponseDto[]> {
    return this.reminderService.listPreferences(user.sub);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Create or replace reminder preferences (global or per tournament)' })
  @ApiResponse({ status: 200, type: ReminderPreferenceResponseDto })
  @ApiCommonErrorResponses()
  upsert(
    @Body() dto: UpdateReminderPreferenceDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ReminderPreferenceResponseDto> {
    return this.reminderService.upsertPreference(user.sub, dto);
  }
}
