import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockChatFindMany = vi.fn();
const mockChatFindFirst = vi.fn();
const mockRedisPublish = vi.fn();
const mockRedisSub = { subscribe: vi.fn(), on: vi.fn() };

vi.mock('@/shared/utils', () => ({
  prisma: {
    chat: { findMany: mockChatFindMany, findFirst: mockChatFindFirst },
  },
  redis: { publish: mockRedisPublish },
  redisSub: mockRedisSub,
}));

const mockSendMessage = vi.fn();
const mockVerifyToken = vi.fn();

vi.mock('../chat.service', () => ({
  ChatService: vi.fn().mockImplementation(() => ({
    sendMessage: mockSendMessage,
  })),
}));

vi.mock('@/rest/auth/oidc-auth.service', () => ({
  OidcAuthService: vi.fn().mockImplementation(() => ({
    verifyToken: mockVerifyToken,
  })),
}));

const { ChatGateway } = await import('../chat.gateway');
const { OidcAuthService } = await import('@/rest/auth/oidc-auth.service');
const { ChatService } = await import('../chat.service');

interface MockSocket {
  handshake: { auth: Record<string, unknown> };
  data: Record<string, unknown>;
  emit: ReturnType<typeof vi.fn>;
  join: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  to: ((room: string) => { emit: ReturnType<typeof vi.fn> }) & ReturnType<typeof vi.fn>;
}

function createMockSocket(token?: string): MockSocket {
  const roomEmit = vi.fn();
  return {
    handshake: { auth: token ? { token } : {} },
    data: {},
    emit: vi.fn(),
    join: vi.fn(),
    disconnect: vi.fn(),
    to: vi.fn(() => ({ emit: roomEmit })) as MockSocket['to'],
  };
}

const MOCK_USER = {
  sub: 'user-1',
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  scopes: ['openid'],
  payload: { sub: 'user-1' },
};

const NOW = new Date('2026-01-01T00:00:00Z');

describe('ChatGateway', () => {
  let gateway: InstanceType<typeof ChatGateway>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: OidcAuthService, useValue: { verifyToken: mockVerifyToken } },
        { provide: ChatService, useValue: { sendMessage: mockSendMessage } },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    gateway.server = { to: vi.fn(() => ({ emit: vi.fn() })) } as never;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── handleConnection ────────────────────────────────────

  describe('handleConnection', () => {
    it('should authenticate and join chat rooms on valid token', async () => {
      mockVerifyToken.mockResolvedValue(MOCK_USER);
      mockChatFindMany.mockResolvedValue([{ id: 'chat-1' }, { id: 'chat-2' }]);
      const client = createMockSocket('valid-token');

      await gateway.handleConnection(client as never);

      expect(mockVerifyToken).toHaveBeenCalledWith('valid-token');
      expect(client.data.user).toEqual(MOCK_USER);
      expect(client.join).toHaveBeenCalledWith(['chat:chat-1', 'chat:chat-2']);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect when token is missing', async () => {
      const client = createMockSocket();

      await gateway.handleConnection(client as never);

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Missing authentication token',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should disconnect when token is invalid', async () => {
      mockVerifyToken.mockRejectedValue(new Error('Invalid token'));
      const client = createMockSocket('bad-token');

      await gateway.handleConnection(client as never);

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Authentication failed' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should handle user with no chats', async () => {
      mockVerifyToken.mockResolvedValue(MOCK_USER);
      mockChatFindMany.mockResolvedValue([]);
      const client = createMockSocket('valid-token');

      await gateway.handleConnection(client as never);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  // ─── handleSendMessage ────────────────────────────────────

  describe('handleSendMessage', () => {
    it('should save message and return success', async () => {
      const mockMessage = {
        id: 'msg-1',
        chatId: 'chat-1',
        sender: { id: 'user-1', username: 'testuser', name: 'Test User' },
        content: 'Hello!',
        type: 'TEXT',
        mediaUrl: null,
        read: false,
        createdAt: NOW,
      };
      mockSendMessage.mockResolvedValue(mockMessage);

      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      const result = await gateway.handleSendMessage(client as never, {
        chatId: 'chat-1',
        content: 'Hello!',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMessage);
      expect(mockSendMessage).toHaveBeenCalledWith(
        { chatId: 'chat-1', content: 'Hello!' },
        'user-1'
      );
    });

    it('should return error when chatId is missing', async () => {
      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      const result = await gateway.handleSendMessage(client as never, {
        chatId: '',
        content: 'Hello!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('chatId is required');
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should return error when content is missing', async () => {
      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      const result = await gateway.handleSendMessage(client as never, {
        chatId: 'chat-1',
        content: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('content is required');
    });

    it('should return error when content exceeds 5000 chars', async () => {
      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      const result = await gateway.handleSendMessage(client as never, {
        chatId: 'chat-1',
        content: 'a'.repeat(5001),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('content must not exceed 5000 characters');
    });

    it('should return error when user is not a member', async () => {
      mockSendMessage.mockRejectedValue(
        new ForbiddenException('You are not a member of this chat')
      );
      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      const result = await gateway.handleSendMessage(client as never, {
        chatId: 'chat-1',
        content: 'Hello!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('You are not a member of this chat');
    });
  });

  // ─── handleJoinChat ────────────────────────────────────────

  describe('handleJoinChat', () => {
    it('should join room when user is a member', async () => {
      mockChatFindFirst.mockResolvedValue({ id: 'chat-1' });
      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      const result = await gateway.handleJoinChat(client as never, { chatId: 'chat-1' });

      expect(result.success).toBe(true);
      expect(client.join).toHaveBeenCalledWith('chat:chat-1');
    });

    it('should return error when user is not a member', async () => {
      mockChatFindFirst.mockResolvedValue(null);
      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      const result = await gateway.handleJoinChat(client as never, { chatId: 'chat-1' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('You are not a member of this chat');
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should return error when chatId is missing', async () => {
      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      const result = await gateway.handleJoinChat(client as never, { chatId: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('chatId is required');
    });
  });

  // ─── typing events ────────────────────────────────────────

  describe('typing events', () => {
    it('should broadcast typing_start to room', () => {
      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      gateway.handleTypingStart(client as never, { chatId: 'chat-1' });

      expect(client.to).toHaveBeenCalledWith('chat:chat-1');
      expect(client.to('chat:chat-1').emit).toHaveBeenCalledWith('typing_start', {
        chatId: 'chat-1',
        userId: 'user-1',
        username: 'testuser',
      });
    });

    it('should broadcast typing_stop to room', () => {
      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      gateway.handleTypingStop(client as never, { chatId: 'chat-1' });

      expect(client.to).toHaveBeenCalledWith('chat:chat-1');
      expect(client.to('chat:chat-1').emit).toHaveBeenCalledWith('typing_stop', {
        chatId: 'chat-1',
        userId: 'user-1',
      });
    });

    it('should not broadcast typing_start when chatId is missing', () => {
      const client = createMockSocket('token');
      client.data = { user: MOCK_USER };

      gateway.handleTypingStart(client as never, { chatId: '' });

      expect(client.to).not.toHaveBeenCalled();
    });
  });
});
