import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import {
  ApiCommonErrorResponses,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
} from '@/rest/common';
import { ZodValidationPipe } from '@/rest/common/pagination';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ChatHistoryResponseDto } from './dto/chat-history-response.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { chatPaginationSchema, type ChatPaginationParams } from './dto/chat-history-query.dto';

@ApiTags('Chats')
@ApiBearerAuth()
@Controller({ path: 'chats', version: '1' })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new chat (1-to-1 or group)' })
  @ApiResponse({ status: 201, type: ChatResponseDto })
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  createChat(
    @Body() dto: CreateChatDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ChatResponseDto> {
    return this.chatService.createChat(dto, user.sub);
  }

  @Get('history/:chatId')
  @ApiOperation({ summary: 'Get paginated message history for a chat' })
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
    return this.chatService.getHistory(chatId, user.sub, pagination);
  }

  @Post('send-message')
  @ApiOperation({ summary: 'Send a message to a chat' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MessageResponseDto> {
    return this.chatService.sendMessage(dto, user.sub);
  }
}
