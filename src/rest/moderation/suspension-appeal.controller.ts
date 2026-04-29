import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { AllowSuspended } from '@/rest/auth/allow-suspended.decorator';
import { ApiBadRequestResponse, ApiCommonErrorResponses, ApiNotFoundResponse } from '@/rest/common';
import { ModerationService } from './moderation.service';
import {
  SubmitSuspensionAppealDto,
  SuspensionAppealResponseDto,
} from './dto/suspension-appeal.dto';

/**
 * Self-service appeal endpoints. Live outside ModerationController because
 * that one's gated to mods; suspended users need to reach these to submit
 * an appeal while their account is locked.
 */
@ApiTags('Suspension Appeals (self-service)')
@ApiBearerAuth()
@Controller({ path: 'me/suspension-appeals', version: '1' })
export class SuspensionAppealController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post()
  @AllowSuspended()
  @ApiOperation({ summary: 'Submit an appeal of the current active suspension.' })
  @ApiResponse({ status: 201, type: SuspensionAppealResponseDto })
  @ApiBadRequestResponse('No active suspension or already-pending appeal')
  @ApiCommonErrorResponses()
  submit(
    @Body() dto: SubmitSuspensionAppealDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<SuspensionAppealResponseDto> {
    return this.moderationService.submitSuspensionAppeal(user.sub, dto);
  }

  @Get()
  @AllowSuspended()
  @ApiOperation({ summary: 'List my own suspension appeals (any status).' })
  @ApiResponse({ status: 200, type: [SuspensionAppealResponseDto] })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<SuspensionAppealResponseDto[]> {
    return this.moderationService.listMyAppeals(user.sub);
  }
}
