import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, redis } from '@/shared/utils';
import { paginate } from '@/rest/common/pagination';
import { UserBlockService } from '@/rest/user-block/user-block.service';
import type { OrganizationRole } from '@/generated/prisma/client';
import type { ChatResponseDto } from './dto/chat-response.dto';
import type { MessageResponseDto } from './dto/message-response.dto';
import type { ChatHistoryResponseDto } from './dto/chat-history-response.dto';
import type { UserChatResponseDto } from './dto/user-chat-response.dto';
import type { CreateChatDto } from './dto/create-chat.dto';
import type { CreateAnnouncementChatDto } from './dto/create-announcement-chat.dto';
import type { UpdateAnnouncementChatDto } from './dto/update-announcement-chat.dto';
import type { SendMessageDto } from './dto/send-message.dto';
import type { ChatPaginationParams } from './dto/chat-history-query.dto';
import type { SearchMessagesParams } from './dto/search-messages-query.dto';
import type { SearchMessagesResponseDto } from './dto/search-messages-response.dto';

const MEMBER_SELECT = { id: true, username: true, name: true } as const;
const MEDIA_SELECT = { id: true, url: true, mimeType: true } as const;

function mapMedia(media: { id: string; url: string; mimeType: string }[]) {
  return media.map((m) => ({ id: m.id, url: m.url, mimeType: m.mimeType }));
}

@Injectable()
export class ChatService {
  constructor(private readonly userBlockService: UserBlockService) {}

  async getUserChats(userId: string): Promise<UserChatResponseDto[]> {
    const chats = await prisma.chat.findMany({
      where: { members: { some: { id: userId } } },
      include: {
        members: { select: MEMBER_SELECT },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: MEMBER_SELECT },
            media: { select: MEDIA_SELECT },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return chats.map((chat) => {
      const lastMsg = chat.messages[0] ?? null;
      return {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        creatorId: chat.creatorId,
        members: chat.members,
        createdAt: chat.createdAt,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              chatId: lastMsg.chatId,
              sender: lastMsg.sender,
              content: lastMsg.content,
              type: lastMsg.type,
              mediaUrl: lastMsg.mediaUrl,
              media: mapMedia(lastMsg.media),
              read: lastMsg.read,
              createdAt: lastMsg.createdAt,
            }
          : null,
      };
    });
  }

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

    for (const recipientId of uniqueRecipientIds) {
      if (await this.userBlockService.isBlocked(creatorId, recipientId)) {
        throw new ForbiddenException('Cannot start a chat with a blocked user');
      }
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
            include: {
              sender: { select: MEMBER_SELECT },
              media: { select: MEDIA_SELECT },
            },
          })
          .then((messages) =>
            messages.map((m) => ({
              id: m.id,
              chatId: m.chatId,
              sender: m.sender,
              content: m.content,
              type: m.type,
              mediaUrl: m.mediaUrl,
              media: mapMedia(m.media),
              read: m.read,
              createdAt: m.createdAt,
            }))
          )
    );
  }

  async sendMessage(dto: SendMessageDto, senderId: string): Promise<MessageResponseDto> {
    const chat = await prisma.chat.findFirst({
      where: { id: dto.chatId, members: { some: { id: senderId } } },
      include: {
        members: { select: { id: true } },
      },
    });

    if (!chat) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    // Enforce user-to-user block for direct messages
    if (chat.type === 'DIRECT') {
      const other = chat.members.find((m) => m.id !== senderId);
      if (other && (await this.userBlockService.isBlocked(senderId, other.id))) {
        throw new ForbiddenException('Cannot send messages to a blocked user');
      }
    }

    // Enforce write permissions for announcement channels
    if (chat.type === 'ANNOUNCEMENT') {
      if (!chat.organizationId) {
        throw new Error(`Announcement channel ${chat.id} is missing an organization`);
      }
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: { userId: senderId, organizationId: chat.organizationId },
        },
      });
      if (!membership || !chat.writeRoles.includes(membership.role)) {
        throw new ForbiddenException(
          'You do not have write permission in this announcement channel'
        );
      }
    }

    // Resolve media attachments
    let messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE' = 'TEXT';
    const mediaConnect = dto.mediaIds?.length ? dto.mediaIds.map((id) => ({ id })) : undefined;

    if (dto.mediaIds?.length) {
      const mediaRecords = await prisma.media.findMany({
        where: { id: { in: dto.mediaIds }, userId: senderId },
        select: { id: true, mimeType: true },
      });

      if (mediaRecords.length !== dto.mediaIds.length) {
        throw new BadRequestException('One or more media IDs are invalid or not owned by you');
      }

      // Derive message type from first attachment
      const firstMime = mediaRecords[0].mimeType;
      if (firstMime.startsWith('image/')) messageType = 'IMAGE';
      else if (firstMime.startsWith('video/')) messageType = 'VIDEO';
      else messageType = 'FILE';
    }

    const message = await prisma.message.create({
      data: {
        chatId: dto.chatId,
        senderId,
        content: dto.content,
        type: messageType,
        ...(mediaConnect && { media: { connect: mediaConnect } }),
      },
      include: {
        sender: { select: MEMBER_SELECT },
        media: { select: MEDIA_SELECT },
      },
    });

    const response: MessageResponseDto = {
      id: message.id,
      chatId: message.chatId,
      sender: message.sender,
      content: message.content,
      type: message.type,
      mediaUrl: message.mediaUrl,
      media: mapMedia(message.media),
      read: message.read,
      createdAt: message.createdAt,
    };

    await redis.publish('chat:messages', JSON.stringify(response));

    return response;
  }

  async searchMessages(
    chatId: string,
    userId: string,
    params: SearchMessagesParams
  ): Promise<SearchMessagesResponseDto> {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, members: { some: { id: userId } } },
      select: { id: true },
    });

    if (!chat) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    const searchTerm = `%${params.q.replace(/[%_]/g, '\\$&')}%`;

    // Single query: assign row numbers (DESC order matching history pagination),
    // then filter by content ILIKE and return matches with their position.
    const hits = await prisma.$queryRaw<
      {
        id: string;
        content: string;
        sender_name: string;
        sender_id: string;
        created_at: Date;
        row_idx: bigint;
      }[]
    >`
      WITH numbered AS (
        SELECT
          m.id,
          m.content,
          COALESCE(u.name, u.username, 'Unknown') AS sender_name,
          u.id AS sender_id,
          m.created_at,
          ROW_NUMBER() OVER (ORDER BY m.created_at DESC) - 1 AS row_idx
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.chat_id = ${chatId}
      )
      SELECT id, content, sender_name, sender_id, created_at, row_idx
      FROM numbered
      WHERE content ILIKE ${searchTerm}
      ORDER BY created_at DESC
      LIMIT ${params.limit}
    `;

    // Count total matches (separate lightweight query)
    const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count
      FROM messages
      WHERE chat_id = ${chatId} AND content ILIKE ${searchTerm}
    `;

    return {
      hits: hits.map((h) => ({
        id: h.id,
        content: h.content,
        senderName: h.sender_name,
        senderId: h.sender_id,
        createdAt: h.created_at,
        index: Number(h.row_idx),
        page: Math.floor(Number(h.row_idx) / params.per_page) + 1,
      })),
      total: Number(count),
    };
  }

  // ─── Announcement Channels ─────────────────────────────

  async createAnnouncementChat(
    dto: CreateAnnouncementChatDto,
    userId: string
  ): Promise<ChatResponseDto> {
    await this.requireOrgRole(dto.organizationId, userId, ['STAFF', 'ADMIN']);

    // Resolve members: specific IDs or all org members
    let memberIds: string[];
    if (dto.memberIds?.length) {
      memberIds = [...new Set([userId, ...dto.memberIds])];
    } else {
      const orgMembers = await prisma.organizationMember.findMany({
        where: { organizationId: dto.organizationId },
        select: { userId: true },
      });
      memberIds = orgMembers.map((m) => m.userId);
      if (!memberIds.includes(userId)) {
        memberIds.push(userId);
      }
    }

    const chat = await prisma.chat.create({
      data: {
        type: 'ANNOUNCEMENT',
        name: dto.name,
        creatorId: userId,
        organizationId: dto.organizationId,
        writeRoles: dto.writeRoles,
        members: { connect: memberIds.map((id) => ({ id })) },
      },
      include: { members: { select: MEMBER_SELECT } },
    });

    return {
      id: chat.id,
      type: chat.type,
      name: chat.name,
      creatorId: chat.creatorId,
      members: chat.members,
      organizationId: chat.organizationId,
      writeRoles: chat.writeRoles,
      createdAt: chat.createdAt,
    };
  }

  async updateAnnouncementChat(
    chatId: string,
    dto: UpdateAnnouncementChatDto,
    userId: string
  ): Promise<ChatResponseDto> {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, type: true, organizationId: true },
    });

    if (!chat || chat.type !== 'ANNOUNCEMENT') {
      throw new NotFoundException('Announcement channel not found');
    }

    if (!chat.organizationId) {
      throw new Error(`Announcement channel ${chat.id} is missing an organization`);
    }

    await this.requireOrgRole(chat.organizationId, userId, ['STAFF', 'ADMIN']);

    const updated = await prisma.chat.update({
      where: { id: chatId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.writeRoles !== undefined && { writeRoles: dto.writeRoles }),
      },
      include: { members: { select: MEMBER_SELECT } },
    });

    return {
      id: updated.id,
      type: updated.type,
      name: updated.name,
      creatorId: updated.creatorId,
      members: updated.members,
      organizationId: updated.organizationId,
      writeRoles: updated.writeRoles,
      createdAt: updated.createdAt,
    };
  }

  async deleteAnnouncementChat(chatId: string, userId: string): Promise<void> {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, type: true, organizationId: true },
    });

    if (!chat || chat.type !== 'ANNOUNCEMENT') {
      throw new NotFoundException('Announcement channel not found');
    }

    if (!chat.organizationId) {
      throw new Error(`Announcement channel ${chat.id} is missing an organization`);
    }

    await this.requireOrgRole(chat.organizationId, userId, ['STAFF', 'ADMIN']);

    await prisma.chat.delete({ where: { id: chatId } });
  }

  private async requireOrgRole(
    organizationId: string,
    userId: string,
    allowedRoles: OrganizationRole[]
  ): Promise<void> {
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires one of: ${allowedRoles.join(', ')}. You have: ${membership.role}`
      );
    }
  }
}
