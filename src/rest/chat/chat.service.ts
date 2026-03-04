import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { paginate } from '@/rest/common/pagination';
import type { ChatResponseDto } from './dto/chat-response.dto';
import type { MessageResponseDto } from './dto/message-response.dto';
import type { ChatHistoryResponseDto } from './dto/chat-history-response.dto';
import type { CreateChatDto } from './dto/create-chat.dto';
import type { SendMessageDto } from './dto/send-message.dto';
import type { ChatPaginationParams } from './dto/chat-history-query.dto';

const MEMBER_SELECT = { id: true, username: true, name: true } as const;

@Injectable()
export class ChatService {
  async createChat(dto: CreateChatDto, creatorId: string): Promise<ChatResponseDto> {
    const uniqueRecipientIds = [...new Set(dto.recipientIds.filter((id) => id !== creatorId))];

    if (uniqueRecipientIds.length === 0) {
      throw new BadRequestException('At least one recipient other than yourself is required');
    }

    const chatType = uniqueRecipientIds.length === 1 ? 'DIRECT' : 'GROUP';

    if (chatType === 'GROUP' && !dto.name) {
      throw new BadRequestException('Group chats require a name');
    }

    // Validate all recipients exist
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: uniqueRecipientIds } },
      select: { id: true },
    });

    if (existingUsers.length !== uniqueRecipientIds.length) {
      const found = new Set(existingUsers.map((u) => u.id));
      const missing = uniqueRecipientIds.filter((id) => !found.has(id));
      throw new NotFoundException(`Users not found: ${missing.join(', ')}`);
    }

    // For DIRECT chats, check if one already exists between these two users
    if (chatType === 'DIRECT') {
      const recipientId = uniqueRecipientIds[0];
      const existing = await prisma.chat.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { id: creatorId } } },
            { members: { some: { id: recipientId } } },
          ],
        },
        include: { members: { select: MEMBER_SELECT } },
      });

      if (existing && existing.members.length === 2) {
        return {
          id: existing.id,
          type: existing.type,
          name: existing.name,
          creatorId: existing.creatorId,
          members: existing.members,
          createdAt: existing.createdAt,
        };
      }
    }

    const allMemberIds = [creatorId, ...uniqueRecipientIds];

    const chat = await prisma.chat.create({
      data: {
        type: chatType,
        name: chatType === 'DIRECT' ? null : dto.name,
        creatorId,
        members: { connect: allMemberIds.map((id) => ({ id })) },
      },
      include: { members: { select: MEMBER_SELECT } },
    });

    return {
      id: chat.id,
      type: chat.type,
      name: chat.name,
      creatorId: chat.creatorId,
      members: chat.members,
      createdAt: chat.createdAt,
    };
  }

  async getHistory(
    chatId: string,
    userId: string,
    pagination: ChatPaginationParams
  ): Promise<ChatHistoryResponseDto> {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, members: { some: { id: userId } } },
      select: { id: true },
    });

    if (!chat) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    return paginate<MessageResponseDto>(
      pagination,
      () => prisma.message.count({ where: { chatId } }),
      ({ skip, take }) =>
        prisma.message
          .findMany({
            where: { chatId },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
            include: { sender: { select: MEMBER_SELECT } },
          })
          .then((messages) =>
            messages.map((m) => ({
              id: m.id,
              chatId: m.chatId,
              sender: m.sender,
              content: m.content,
              type: m.type,
              mediaUrl: m.mediaUrl,
              read: m.read,
              createdAt: m.createdAt,
            }))
          )
    );
  }

  async sendMessage(dto: SendMessageDto, senderId: string): Promise<MessageResponseDto> {
    const chat = await prisma.chat.findFirst({
      where: { id: dto.chatId, members: { some: { id: senderId } } },
      select: { id: true },
    });

    if (!chat) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    const message = await prisma.message.create({
      data: {
        chatId: dto.chatId,
        senderId,
        content: dto.content,
        type: 'TEXT',
      },
      include: { sender: { select: MEMBER_SELECT } },
    });

    // TODO: Publish to Redis for real-time delivery
    // await redis.publish(`chat:${dto.chatId}`, JSON.stringify(response));

    return {
      id: message.id,
      chatId: message.chatId,
      sender: message.sender,
      content: message.content,
      type: message.type,
      mediaUrl: message.mediaUrl,
      read: message.read,
      createdAt: message.createdAt,
    };
  }
}
