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
import { UserChatResponseDto } from './dto/user-chat-response.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { chatPaginationSchema, type ChatPaginationParams } from './dto/chat-history-query.dto';
import { searchMessagesSchema, type SearchMessagesParams } from './dto/search-messages-query.dto';
import { SearchMessagesResponseDto } from './dto/search-messages-response.dto';

@ApiTags('Chats')
@ApiBearerAuth()
@Controller({ path: 'chats', version: '1' })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Get all chats for the authenticated user' })
  @ApiResponse({ status: 200, type: [UserChatResponseDto] })
  @ApiCommonErrorResponses()
  getUserChats(@CurrentUser() user: AuthenticatedUser): Promise<UserChatResponseDto[]> {
    return this.chatService.getUserChats(user.sub);
  }

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

  @Get('search/:chatId')
  @ApiOperation({ summary: 'Search messages in a chat thread' })
  @ApiResponse({ status: 200, type: SearchMessagesResponseDto })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Max results (1-50)',
  })
  @ApiQuery({
    name: 'per_page',
    required: false,
    type: Number,
    example: 50,
    description: 'Page size used by history endpoint (for page calculation)',
  })
  @ApiForbiddenResponse()
  @ApiCommonErrorResponses()
  searchMessages(
    @Param('chatId') chatId: string,
    @Query(new ZodValidationPipe(searchMessagesSchema)) params: SearchMessagesParams,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<SearchMessagesResponseDto> {
    return this.chatService.searchMessages(chatId, user.sub, params);
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
