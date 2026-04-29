import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import {
  ApiCommonErrorResponses,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  Roles,
} from '@/rest/common';
import { RolesGuard } from '@/rest/common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import {
  BanUserDto,
  DeleteMessageDto,
  FlagMessageDto,
  ListMessagesQueryDto,
  RestrictUserDto,
  SuspendUserDto,
  UnrestrictUserDto,
} from './dto/moderation.dto';
import {
  DecideSuspensionAppealDto,
  SuspensionAppealResponseDto,
} from './dto/suspension-appeal.dto';

@ApiTags('Moderation')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('DEPT_MANAGER', 'ADMIN')
@Controller({ path: 'moderation', version: '1' })
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('messages')
  @ApiOperation({ summary: 'List inter-team messages for moderation (dept manager only)' })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  listMessages(@Query() query: ListMessagesQueryDto) {
    return this.moderationService.listInterTeamMessages(query);
  }

  @Post('messages/:id/flag')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Flag a message and hide it from conversations' })
  @ApiResponse({ status: 204, description: 'Message flagged' })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  flagMessage(
    @Param('id') id: string,
    @Body() dto: FlagMessageDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.moderationService.flagMessage(id, dto, user.sub);
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message and log to audit trail' })
  @ApiResponse({ status: 204, description: 'Message deleted' })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  deleteMessage(
    @Param('id') id: string,
    @Body() dto: DeleteMessageDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.moderationService.deleteMessage(id, dto, user.sub);
  }

  @Post('users/:userId/suspend')
  @ApiOperation({ summary: 'Suspend a user for a set duration' })
  @ApiCommonErrorResponses()
  suspend(
    @Param('userId') userId: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.moderationService.suspendUser(userId, dto, user.sub);
  }

  @Post('users/:userId/unsuspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an active suspension' })
  @ApiNotFoundResponse()
  unsuspend(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.moderationService.unsuspendUser(userId, user.sub);
  }

  @Post('users/:userId/ban')
  @ApiOperation({ summary: 'Permanently ban a user' })
  ban(
    @Param('userId') userId: string,
    @Body() dto: BanUserDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.moderationService.banUser(userId, dto, user.sub);
  }

  @Post('users/:userId/unban')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an active ban' })
  @ApiNotFoundResponse()
  unban(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.moderationService.unbanUser(userId, user.sub);
  }

  @Post('users/:userId/restrict')
  @ApiOperation({ summary: 'Apply partial action restrictions to a user' })
  restrict(
    @Param('userId') userId: string,
    @Body() dto: RestrictUserDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.moderationService.restrictUser(userId, dto, user.sub);
  }

  @Post('users/:userId/unrestrict')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Lift one or more partial restrictions' })
  unrestrict(
    @Param('userId') userId: string,
    @Body() dto: UnrestrictUserDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.moderationService.unrestrictUser(userId, dto, user.sub);
  }

  @Get('suspension-appeals')
  @ApiOperation({ summary: 'List pending suspension appeals (mod queue)' })
  @ApiResponse({ status: 200, type: [SuspensionAppealResponseDto] })
  @ApiCommonErrorResponses()
  listPendingAppeals(): Promise<SuspensionAppealResponseDto[]> {
    return this.moderationService.listPendingAppeals();
  }

  @Post('suspension-appeals/:id/decide')
  @ApiOperation({ summary: 'Approve or deny a suspension appeal' })
  @ApiResponse({ status: 201, type: SuspensionAppealResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  decideSuspensionAppeal(
    @Param('id') id: string,
    @Body() dto: DecideSuspensionAppealDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<SuspensionAppealResponseDto> {
    return this.moderationService.decideSuspensionAppeal(id, dto, user.sub);
  }
}
