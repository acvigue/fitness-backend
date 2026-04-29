import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockChatModel = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
};

const mockTeamModel = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
};

const mockMessageModel = {
  create: vi.fn(),
};

const mockMediaModel = {
  findMany: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    chat: mockChatModel,
    team: mockTeamModel,
    message: mockMessageModel,
    media: mockMediaModel,
    organizationMember: { findUnique: vi.fn() },
  },
  redis: { publish: vi.fn() },
  redisSub: {},
}));

const { ChatService } = await import('../../chat/chat.service');
const { TeamBlockService } = await import('../../team-block/team-block.service');
const { NotificationService } = await import('../../notification/notification.service');
const { TeamChatService } = await import('../team-chat.service');

const NOW = new Date('2026-01-01T00:00:00Z');

const TEAM1_USERS = [{ id: 'user-1' }, { id: 'user-2' }];
const TEAM2_USERS = [{ id: 'user-3' }, { id: 'user-4' }];

function mockTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: 'team-1',
    name: 'Team Alpha',
    captainId: 'user-1',
    users: TEAM1_USERS,
    ...overrides,
  };
}

const mockNotificationService = {
  create: vi.fn(),
};

describe('TeamChatService', () => {
  let service: InstanceType<typeof TeamChatService>;
  let teamBlockService: InstanceType<typeof TeamBlockService>;

  beforeAll(async () => {
    const { UserBlockService } = await import('@/rest/user-block/user-block.service');
    const { EngagementService } = await import('@/rest/engagement/engagement.service');
    const { ModerationService } = await import('@/rest/moderation/moderation.service');
    const module = await Test.createTestingModule({
      providers: [
        TeamChatService,
        ChatService,
        TeamBlockService,
        { provide: NotificationService, useValue: mockNotificationService },
        {
          provide: UserBlockService,
          useValue: {
            isBlockedEitherWay: vi.fn().mockResolvedValue(false),
            hasBlocked: vi.fn().mockResolvedValue(false),
          },
        },
        { provide: EngagementService, useValue: { recordEvent: vi.fn().mockResolvedValue({}) } },
        {
          provide: ModerationService,
          useValue: { assertAllowed: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(TeamChatService);
    teamBlockService = module.get(TeamBlockService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createOrGetTeamChat ──────────────────────────────

  describe('createOrGetTeamChat', () => {
    it('should create a new team chat', async () => {
      mockTeamModel.findUnique
        .mockResolvedValueOnce(mockTeam())
        .mockResolvedValueOnce(mockTeam({ id: 'team-2', name: 'Team Beta', users: TEAM2_USERS }));
      vi.spyOn(teamBlockService, 'isBlockedEitherWay').mockResolvedValue(false);
      mockChatModel.findUnique.mockResolvedValue(null);
      mockChatModel.create.mockResolvedValue({
        id: 'chat-1',
        name: 'Team Alpha x Team Beta',
        team1Id: 'team-1',
        team2Id: 'team-2',
        members: [
          { id: 'user-1', username: 'u1', name: 'U1' },
          { id: 'user-2', username: 'u2', name: 'U2' },
          { id: 'user-3', username: 'u3', name: 'U3' },
          { id: 'user-4', username: 'u4', name: 'U4' },
        ],
        createdAt: NOW,
      });

      const result = await service.createOrGetTeamChat(
        { fromTeamId: 'team-1', toTeamId: 'team-2' },
        'user-1'
      );

      expect(result.name).toBe('Team Alpha x Team Beta');
      expect(result.members).toHaveLength(4);
    });

    it('should return existing chat if one exists', async () => {
      mockTeamModel.findUnique
        .mockResolvedValueOnce(mockTeam())
        .mockResolvedValueOnce(mockTeam({ id: 'team-2', users: TEAM2_USERS }));
      vi.spyOn(teamBlockService, 'isBlockedEitherWay').mockResolvedValue(false);
      mockChatModel.findUnique.mockResolvedValue({
        id: 'existing-chat',
        name: 'Team Alpha x Team Beta',
        team1Id: 'team-1',
        team2Id: 'team-2',
        members: [],
        createdAt: NOW,
      });

      const result = await service.createOrGetTeamChat(
        { fromTeamId: 'team-1', toTeamId: 'team-2' },
        'user-1'
      );

      expect(result.id).toBe('existing-chat');
      expect(mockChatModel.create).not.toHaveBeenCalled();
    });

    it('should throw when teams are blocked', async () => {
      mockTeamModel.findUnique.mockResolvedValue(mockTeam());
      vi.spyOn(teamBlockService, 'isBlockedEitherWay').mockResolvedValue(true);

      await expect(
        service.createOrGetTeamChat({ fromTeamId: 'team-1', toTeamId: 'team-2' }, 'user-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw when user is not a team member', async () => {
      mockTeamModel.findUnique.mockResolvedValue(mockTeam());

      await expect(
        service.createOrGetTeamChat({ fromTeamId: 'team-1', toTeamId: 'team-2' }, 'outsider')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw when trying to chat with own team', async () => {
      await expect(
        service.createOrGetTeamChat({ fromTeamId: 'team-1', toTeamId: 'team-1' }, 'user-1')
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getTeamChats ────────────────────────────────────

  describe('getTeamChats', () => {
    it('should return team chats for a team member', async () => {
      mockTeamModel.findUnique.mockResolvedValue(mockTeam());
      mockChatModel.findMany.mockResolvedValue([
        {
          id: 'chat-1',
          name: 'Team Alpha x Team Beta',
          team1Id: 'team-1',
          team2Id: 'team-2',
          members: [],
          createdAt: NOW,
        },
      ]);

      const result = await service.getTeamChats('team-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Team Alpha x Team Beta');
    });

    it('should throw when user is not a team member', async () => {
      mockTeamModel.findUnique.mockResolvedValue(mockTeam());

      await expect(service.getTeamChats('team-1', 'outsider')).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── sendTeamMessage ─────────────────────────────────

  describe('sendTeamMessage', () => {
    it('should throw when teams are blocked', async () => {
      mockChatModel.findUnique.mockResolvedValue({
        id: 'chat-1',
        type: 'TEAM',
        team1Id: 'team-1',
        team2Id: 'team-2',
      });
      vi.spyOn(teamBlockService, 'isBlockedEitherWay').mockResolvedValue(true);

      await expect(
        service.sendTeamMessage('chat-1', { content: 'Hello!' }, 'user-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw for non-team chat', async () => {
      mockChatModel.findUnique.mockResolvedValue({ id: 'chat-1', type: 'DIRECT' });

      await expect(
        service.sendTeamMessage('chat-1', { content: 'Hello!' }, 'user-1')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
