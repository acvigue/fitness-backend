import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import {
  ApiCommonErrorResponses,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
} from '@/rest/common';
import { ZodValidationPipe } from '@/rest/common/pagination';
import { TeamChatService } from './team-chat.service';
import { CreateTeamChatDto } from './dto/create-team-chat.dto';
import { TeamChatResponseDto } from './dto/team-chat-response.dto';
import { SendTeamMessageDto } from './dto/send-team-message.dto';
import { MessageResponseDto } from '@/rest/chat/dto/message-response.dto';
import { ChatHistoryResponseDto } from '@/rest/chat/dto/chat-history-response.dto';
import {
  chatPaginationSchema,
  type ChatPaginationParams,
} from '@/rest/chat/dto/chat-history-query.dto';

@ApiTags('Team Chats')
@ApiBearerAuth()
@Controller({ path: 'team-chats', version: '1' })
export class TeamChatController {
  constructor(private readonly teamChatService: TeamChatService) {}

  @Post()
  @ApiOperation({ summary: 'Create or get a team-to-team chat' })
  @ApiResponse({ status: 201, type: TeamChatResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  createOrGetTeamChat(
    @Body() dto: CreateTeamChatDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamChatResponseDto> {
    return this.teamChatService.createOrGetTeamChat(dto, user.sub);
  }

  @Get('team/:teamId')
  @ApiOperation({ summary: 'List all team chats for a team' })
  @ApiResponse({ status: 200, type: [TeamChatResponseDto] })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  getTeamChats(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamChatResponseDto[]> {
    return this.teamChatService.getTeamChats(teamId, user.sub);
  }

  @Post(':chatId/messages')
  @ApiOperation({ summary: 'Send a message in a team chat' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  sendTeamMessage(
    @Param('chatId') chatId: string,
    @Body() dto: SendTeamMessageDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MessageResponseDto> {
    return this.teamChatService.sendTeamMessage(chatId, dto, user.sub);
  }

  @Get(':chatId/history')
  @ApiOperation({ summary: 'Get paginated message history for a team chat' })
  @ApiResponse({ status: 200, type: ChatHistoryResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 50 })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  getHistory(
    @Param('chatId') chatId: string,
    @Query(new ZodValidationPipe(chatPaginationSchema)) pagination: ChatPaginationParams,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ChatHistoryResponseDto> {
    return this.teamChatService.getHistory(chatId, user.sub, pagination);
  }
}
