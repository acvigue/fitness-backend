import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { OidcAuthService, type AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { ChatService } from './chat.service';
import { prisma, redisSub } from '@/shared/utils';
import { LoggerService } from '@/shared/logger';
import { CORS_ALLOWED_ORIGINS } from '@/rest/config/rest.constants';
import { MessageResponseDto } from './dto/message-response.dto';
import {
  WsSendMessageDto,
  WsSendMessageResponseDto,
  WsJoinChatDto,
  WsAckResponseDto,
  WsTypingDto,
  WsTypingEventDto,
  WsTypingStopEventDto,
  WsMarkReadDto,
  WsMessagesReadEventDto,
} from './dto/ws-events.dto';

interface AuthenticatedSocket extends Socket {
  data: {
    user: AuthenticatedUser;
  };
}

const REDIS_CHANNEL = 'chat:messages';
const REDIS_READ_CHANNEL = 'chat:messages-read';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: CORS_ALLOWED_ORIGINS,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new LoggerService();

  constructor(
    private readonly authService: OidcAuthService,
    private readonly chatService: ChatService
  ) {
    this.logger.setContext('ChatGateway');
  }

  // ─── Lifecycle ──────────────────────────────────────────

  afterInit(): void {
    this.logger.log('Chat WebSocket gateway initialized');
    this.subscribeToRedis();
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        client.emit('error', { message: 'Missing authentication token' });
        client.disconnect(true);
        return;
      }

      const user = await this.authService.verifyToken(token);
      client.data.user = user;

      const chats = await prisma.chat.findMany({
        where: { members: { some: { id: user.sub } } },
        select: { id: true },
      });

      const roomIds = chats.map((c) => `chat:${c.id}`);
      if (roomIds.length > 0) {
        await client.join(roomIds);
      }

      this.logger.log(`Client connected: ${user.sub} (joined ${roomIds.length} rooms)`);
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const userId = client.data?.user?.sub ?? 'unknown';
    this.logger.log(`Client disconnected: ${userId}`);
  }

  // ─── Events ─────────────────────────────────────────────

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: WsSendMessageDto
  ): Promise<WsSendMessageResponseDto> {
    const user = client.data.user;

    if (!payload.chatId || typeof payload.chatId !== 'string') {
      return { success: false, error: 'chatId is required' };
    }
    if (!payload.content || typeof payload.content !== 'string') {
      return { success: false, error: 'content is required' };
    }
    if (payload.content.length > 5000) {
      return { success: false, error: 'content must not exceed 5000 characters' };
    }

    try {
      const message = await this.chatService.sendMessage(
        { chatId: payload.chatId, content: payload.content, mediaIds: payload.mediaIds },
        user.sub
      );

      return { success: true, data: message };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to send message';
      return { success: false, error: msg };
    }
  }

  emitNewMessage(message: MessageResponseDto): void {
    this.server.to(`chat:${message.chatId}`).emit('new_message', message);
  }

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: WsJoinChatDto
  ): Promise<WsAckResponseDto> {
    const user = client.data.user;

    if (!payload.chatId || typeof payload.chatId !== 'string') {
      return { success: false, error: 'chatId is required' };
    }

    const chat = await prisma.chat.findFirst({
      where: { id: payload.chatId, members: { some: { id: user.sub } } },
      select: { id: true },
    });

    if (!chat) {
      return { success: false, error: 'You are not a member of this chat' };
    }

    await client.join(`chat:${payload.chatId}`);
    return { success: true };
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: WsTypingDto
  ): void {
    if (!payload.chatId) return;
    const event: WsTypingEventDto = {
      chatId: payload.chatId,
      userId: client.data.user.sub,
      username: client.data.user.username,
    };
    client.to(`chat:${payload.chatId}`).emit('typing_start', event);
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: WsTypingDto
  ): void {
    if (!payload.chatId) return;
    const event: WsTypingStopEventDto = {
      chatId: payload.chatId,
      userId: client.data.user.sub,
    };
    client.to(`chat:${payload.chatId}`).emit('typing_stop', event);
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: WsMarkReadDto
  ): Promise<WsAckResponseDto> {
    if (!payload.chatId || typeof payload.chatId !== 'string') {
      return { success: false, error: 'chatId is required' };
    }
    try {
      await this.chatService.markChatRead(payload.chatId, client.data.user.sub);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to mark chat as read';
      return { success: false, error: msg };
    }
  }

  emitMessagesRead(event: WsMessagesReadEventDto): void {
    this.server.to(`chat:${event.chatId}`).emit('messages_read', event);
  }

  // ─── Redis Pub/Sub ──────────────────────────────────────

  private subscribeToRedis(): void {
    redisSub.subscribe(REDIS_CHANNEL, REDIS_READ_CHANNEL, (err) => {
      if (err) {
        this.logger.error(`Failed to subscribe to chat channels: ${err.message}`);
      } else {
        this.logger.log(`Subscribed to Redis chat channels`);
      }
    });

    redisSub.on('message', (channel: string, rawMessage: string) => {
      try {
        if (channel === REDIS_CHANNEL) {
          const message = JSON.parse(rawMessage) as MessageResponseDto;
          this.emitNewMessage(message);
        } else if (channel === REDIS_READ_CHANNEL) {
          const event = JSON.parse(rawMessage) as WsMessagesReadEventDto;
          this.emitMessagesRead(event);
        }
      } catch (error) {
        this.logger.error(`Failed to parse Redis message: ${(error as Error).message}`);
      }
    });
  }
}
