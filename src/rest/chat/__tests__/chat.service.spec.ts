import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockChatModel = {
  create: vi.fn(),
  findFirst: vi.fn(),
};

const mockMessageModel = {
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
};

const mockUserModel = {
  findMany: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    chat: mockChatModel,
    message: mockMessageModel,
    user: mockUserModel,
  },
  redis: { publish: vi.fn() },
  redisSub: {},
}));

const { ChatService } = await import('../chat.service');

const NOW = new Date('2026-01-01T00:00:00Z');

const MEMBERS = [
  { id: 'creator-1', username: 'creator', name: 'Creator' },
  { id: 'user-2', username: 'recipient', name: 'Recipient' },
];

function mockChat(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chat-1',
    type: 'DIRECT',
    name: null,
    creatorId: 'creator-1',
    members: MEMBERS,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function mockMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    chatId: 'chat-1',
    senderId: 'creator-1',
    sender: MEMBERS[0],
    content: 'Hello!',
    type: 'TEXT',
    mediaUrl: null,
    media: [],
    read: false,
    createdAt: NOW,
    ...overrides,
  };
}

describe('ChatService', () => {
  let service: InstanceType<typeof ChatService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [ChatService],
    }).compile();

    service = module.get(ChatService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createChat ────────────────────────────────────────

  describe('createChat', () => {
    it('should create a DIRECT chat with one recipient', async () => {
      mockUserModel.findMany.mockResolvedValue([{ id: 'user-2' }]);
      mockChatModel.findFirst.mockResolvedValue(null);
      mockChatModel.create.mockResolvedValue(mockChat());

      const result = await service.createChat({ recipientIds: ['user-2'] }, 'creator-1');

      expect(result.type).toBe('DIRECT');
      expect(result.name).toBeNull();
      expect(mockChatModel.create).toHaveBeenCalledWith({
        data: {
          type: 'DIRECT',
          name: null,
          creatorId: 'creator-1',
          members: { connect: [{ id: 'creator-1' }, { id: 'user-2' }] },
        },
        include: { members: { select: { id: true, username: true, name: true } } },
      });
    });

    it('should create a GROUP chat with multiple recipients', async () => {
      const groupMembers = [...MEMBERS, { id: 'user-3', username: 'third', name: 'Third' }];
      mockUserModel.findMany.mockResolvedValue([{ id: 'user-2' }, { id: 'user-3' }]);
      mockChatModel.create.mockResolvedValue(
        mockChat({ type: 'GROUP', name: 'Gym Buddies', members: groupMembers })
      );

      const result = await service.createChat(
        { recipientIds: ['user-2', 'user-3'], name: 'Gym Buddies' },
        'creator-1'
      );

      expect(result.type).toBe('GROUP');
      expect(result.name).toBe('Gym Buddies');
    });

    it('should return existing DIRECT chat instead of creating duplicate', async () => {
      mockUserModel.findMany.mockResolvedValue([{ id: 'user-2' }]);
      mockChatModel.findFirst.mockResolvedValue(mockChat());

      const result = await service.createChat({ recipientIds: ['user-2'] }, 'creator-1');

      expect(result.id).toBe('chat-1');
      expect(mockChatModel.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when only recipient is the creator', async () => {
      await expect(
        service.createChat({ recipientIds: ['creator-1'] }, 'creator-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when GROUP chat has no name', async () => {
      mockUserModel.findMany.mockResolvedValue([{ id: 'user-2' }, { id: 'user-3' }]);

      await expect(
        service.createChat({ recipientIds: ['user-2', 'user-3'] }, 'creator-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when a recipient does not exist', async () => {
      mockUserModel.findMany.mockResolvedValue([{ id: 'user-2' }]);

      await expect(
        service.createChat({ recipientIds: ['user-2', 'missing-user'], name: 'Test' }, 'creator-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should deduplicate recipient IDs', async () => {
      mockUserModel.findMany.mockResolvedValue([{ id: 'user-2' }]);
      mockChatModel.findFirst.mockResolvedValue(null);
      mockChatModel.create.mockResolvedValue(mockChat());

      await service.createChat({ recipientIds: ['user-2', 'user-2', 'user-2'] }, 'creator-1');

      expect(mockUserModel.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-2'] } },
        select: { id: true },
      });
    });
  });

  // ─── getHistory ────────────────────────────────────────

  describe('getHistory', () => {
    it('should return paginated messages for a chat member', async () => {
      mockChatModel.findFirst.mockResolvedValue({ id: 'chat-1' });
      mockMessageModel.count.mockResolvedValue(1);
      mockMessageModel.findMany.mockResolvedValue([mockMessage()]);

      const result = await service.getHistory('chat-1', 'creator-1', { page: 1, per_page: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].content).toBe('Hello!');
      expect(result.meta.total).toBe(1);
      expect(result.meta.per_page).toBe(50);
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      mockChatModel.findFirst.mockResolvedValue(null);

      await expect(
        service.getHistory('chat-1', 'outsider', { page: 1, per_page: 50 })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return empty data for a chat with no messages', async () => {
      mockChatModel.findFirst.mockResolvedValue({ id: 'chat-1' });
      mockMessageModel.count.mockResolvedValue(0);
      mockMessageModel.findMany.mockResolvedValue([]);

      const result = await service.getHistory('chat-1', 'creator-1', { page: 1, per_page: 50 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should pass correct skip/take for pagination', async () => {
      mockChatModel.findFirst.mockResolvedValue({ id: 'chat-1' });
      mockMessageModel.count.mockResolvedValue(100);
      mockMessageModel.findMany.mockResolvedValue([]);

      await service.getHistory('chat-1', 'creator-1', { page: 3, per_page: 20 });

      expect(mockMessageModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 })
      );
    });
  });

  // ─── sendMessage ────────────────────────────────────────

  describe('sendMessage', () => {
    it('should create a message and return it', async () => {
      mockChatModel.findFirst.mockResolvedValue({ id: 'chat-1' });
      mockMessageModel.create.mockResolvedValue(mockMessage());

      const result = await service.sendMessage(
        { chatId: 'chat-1', content: 'Hello!' },
        'creator-1'
      );

      expect(result.content).toBe('Hello!');
      expect(result.type).toBe('TEXT');
      expect(result.sender.id).toBe('creator-1');
    });

    it('should call prisma.message.create with correct data', async () => {
      mockChatModel.findFirst.mockResolvedValue({ id: 'chat-1' });
      mockMessageModel.create.mockResolvedValue(mockMessage());

      await service.sendMessage({ chatId: 'chat-1', content: 'Test' }, 'creator-1');

      expect(mockMessageModel.create).toHaveBeenCalledWith({
        data: {
          chatId: 'chat-1',
          senderId: 'creator-1',
          content: 'Test',
          type: 'TEXT',
        },
        include: {
          sender: { select: { id: true, username: true, name: true } },
          media: { select: { id: true, url: true, mimeType: true } },
        },
      });
    });

    it('should throw ForbiddenException when sender is not a member', async () => {
      mockChatModel.findFirst.mockResolvedValue(null);

      await expect(
        service.sendMessage({ chatId: 'chat-1', content: 'Hello!' }, 'outsider')
      ).rejects.toThrow(ForbiddenException);

      expect(mockMessageModel.create).not.toHaveBeenCalled();
    });
  });
});
