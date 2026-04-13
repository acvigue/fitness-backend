import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { ChatService } from '@/rest/chat/chat.service';
import { TeamBlockService } from '@/rest/team-block/team-block.service';
import { NotificationService } from '@/rest/notification/notification.service';
import { paginate, type PaginatedResult, type PaginationParams } from '@/rest/common/pagination';
import type { CreateTeamChatDto } from './dto/create-team-chat.dto';
import type { TeamChatResponseDto } from './dto/team-chat-response.dto';
import type { SendTeamMessageDto } from './dto/send-team-message.dto';
import type { MessageResponseDto } from '@/rest/chat/dto/message-response.dto';
import type { ChatHistoryResponseDto } from '@/rest/chat/dto/chat-history-response.dto';
import type { ChatPaginationParams } from '@/rest/chat/dto/chat-history-query.dto';

const MEMBER_SELECT = { id: true, username: true, name: true } as const;

@Injectable()
export class TeamChatService {
  constructor(
    private readonly chatService: ChatService,
    private readonly teamBlockService: TeamBlockService,
    private readonly notificationService: NotificationService
  ) {}

  async createOrGetTeamChat(dto: CreateTeamChatDto, userId: string): Promise<TeamChatResponseDto> {
    if (dto.fromTeamId === dto.toTeamId) {
      throw new BadRequestException('Cannot create a chat with your own team');
    }

    // Verify user is a member of the initiating team
    const fromTeam = await prisma.team.findUnique({
      where: { id: dto.fromTeamId },
      include: { users: { select: { id: true } } },
    });
    if (!fromTeam) throw new NotFoundException('Initiating team not found');

    if (!fromTeam.users.some((u) => u.id === userId)) {
      throw new ForbiddenException('You are not a member of the initiating team');
    }

    // Check block status
    const blocked = await this.teamBlockService.isBlocked(dto.fromTeamId, dto.toTeamId);
    if (blocked) {
      throw new ForbiddenException('Messaging between these teams is blocked');
    }

    const toTeam = await prisma.team.findUnique({
      where: { id: dto.toTeamId },
      include: { users: { select: { id: true } } },
    });
    if (!toTeam) throw new NotFoundException('Target team not found');

    // Normalize team order for unique constraint
    const [team1Id, team2Id] =
      dto.fromTeamId < dto.toTeamId
        ? [dto.fromTeamId, dto.toTeamId]
        : [dto.toTeamId, dto.fromTeamId];

    // Check for existing team chat
    const existing = await prisma.chat.findUnique({
      where: { team1Id_team2Id: { team1Id, team2Id } },
      include: { members: { select: MEMBER_SELECT } },
    });

    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        team1Id: existing.team1Id!,
        team2Id: existing.team2Id!,
        members: existing.members,
        createdAt: existing.createdAt,
      };
    }

    // Create new team chat with all members of both teams
    const allMemberIds = [
      ...new Set([...fromTeam.users.map((u) => u.id), ...toTeam.users.map((u) => u.id)]),
    ];

    const chatName = `${fromTeam.name} x ${toTeam.name}`;

    const chat = await prisma.chat.create({
      data: {
        type: 'TEAM',
        name: chatName,
        creatorId: userId,
        team1Id,
        team2Id,
        members: { connect: allMemberIds.map((id) => ({ id })) },
      },
      include: { members: { select: MEMBER_SELECT } },
    });

    return {
      id: chat.id,
      name: chat.name,
      team1Id: chat.team1Id!,
      team2Id: chat.team2Id!,
      members: chat.members,
      createdAt: chat.createdAt,
    };
  }

  async getTeamChats(teamId: string, userId: string): Promise<TeamChatResponseDto[]> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { users: { select: { id: true } } },
    });
    if (!team) throw new NotFoundException('Team not found');

    if (!team.users.some((u) => u.id === userId)) {
      throw new ForbiddenException('You are not a member of this team');
    }

    const chats = await prisma.chat.findMany({
      where: {
        type: 'TEAM',
        OR: [{ team1Id: teamId }, { team2Id: teamId }],
      },
      include: { members: { select: MEMBER_SELECT } },
      orderBy: { updatedAt: 'desc' },
    });

    return chats.map((c) => ({
      id: c.id,
      name: c.name,
      team1Id: c.team1Id!,
      team2Id: c.team2Id!,
      members: c.members,
      createdAt: c.createdAt,
    }));
  }

  async sendTeamMessage(
    chatId: string,
    dto: SendTeamMessageDto,
    userId: string
  ): Promise<MessageResponseDto> {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, type: true, team1Id: true, team2Id: true },
    });

    if (!chat || chat.type !== 'TEAM') {
      throw new NotFoundException('Team chat not found');
    }

    // Re-check block status
    const blocked = await this.teamBlockService.isBlocked(chat.team1Id!, chat.team2Id!);
    if (blocked) {
      throw new ForbiddenException('Messaging between these teams is blocked');
    }

    // Lazy membership sync: if user is in either team but not in chat, add them
    await this.syncMemberIfNeeded(chatId, chat.team1Id!, chat.team2Id!, userId);

    // Delegate to existing chat service
    const message = await this.chatService.sendMessage(
      { chatId, content: dto.content, mediaIds: dto.mediaIds },
      userId
    );

    // Notify other team's members (fire-and-forget)
    this.notifyOtherTeam(chat.team1Id!, chat.team2Id!, userId, chatId).catch(() => {});

    return message;
  }

  async getHistory(
    chatId: string,
    userId: string,
    pagination: ChatPaginationParams
  ): Promise<ChatHistoryResponseDto> {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, type: true, team1Id: true, team2Id: true },
    });

    if (!chat || chat.type !== 'TEAM') {
      throw new NotFoundException('Team chat not found');
    }

    // Lazy membership sync
    await this.syncMemberIfNeeded(chatId, chat.team1Id!, chat.team2Id!, userId);

    return this.chatService.getHistory(chatId, userId, pagination);
  }

  private async syncMemberIfNeeded(
    chatId: string,
    team1Id: string,
    team2Id: string,
    userId: string
  ): Promise<void> {
    // Check if user is already a chat member
    const isChatMember = await prisma.chat.findFirst({
      where: { id: chatId, members: { some: { id: userId } } },
      select: { id: true },
    });

    if (isChatMember) return;

    // Check if user is a member of either team
    const isTeamMember = await prisma.team.findFirst({
      where: {
        id: { in: [team1Id, team2Id] },
        users: { some: { id: userId } },
      },
      select: { id: true },
    });

    if (!isTeamMember) {
      throw new ForbiddenException('You are not a member of either team');
    }

    // Auto-add to chat
    await prisma.chat.update({
      where: { id: chatId },
      data: { members: { connect: { id: userId } } },
    });
  }

  private async notifyOtherTeam(
    team1Id: string,
    team2Id: string,
    senderId: string,
    chatId: string
  ): Promise<void> {
    // Find which team the sender belongs to
    const senderTeam = await prisma.team.findFirst({
      where: {
        id: { in: [team1Id, team2Id] },
        users: { some: { id: senderId } },
      },
      select: { id: true, name: true },
    });

    if (!senderTeam) return;

    const otherTeamId = senderTeam.id === team1Id ? team2Id : team1Id;
    const otherTeam = await prisma.team.findUnique({
      where: { id: otherTeamId },
      include: { users: { select: { id: true } } },
    });

    if (!otherTeam) return;

    for (const member of otherTeam.users) {
      if (member.id !== senderId) {
        await this.notificationService.create(
          member.id,
          'TEAM_MESSAGE',
          'New Team Message',
          `New message in ${senderTeam.name} x ${otherTeam.name} chat`
        );
      }
    }
  }
}
