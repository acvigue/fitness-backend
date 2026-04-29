import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotification = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  count: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    notification: mockNotification,
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ notification: mockNotification })
    ),
  },
  redis: {},
  redisSub: {},
}));

const { NotificationService } = await import('../notification.service');

const NOW = new Date('2026-01-01T00:00:00Z');

function mockN(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'TEAM_INVITE',
    title: 'Team Invitation',
    content: 'You have been invited to join Team Alpha',
    metadata: null,
    readAt: null,
    dismissed: false,
    createdAt: NOW,
    ...overrides,
  };
}

describe('NotificationService', () => {
  let service: InstanceType<typeof NotificationService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [NotificationService],
    }).compile();

    service = module.get(NotificationService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated notifications for a user', async () => {
      mockNotification.count.mockResolvedValue(2);
      mockNotification.findMany.mockResolvedValue([mockN(), mockN({ id: 'notif-2' })]);

      const result = await service.findAll('user-1', { page: 1, per_page: 20 });

      expect(mockNotification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('notif-1');
      expect(result.data[0].type).toBe('TEAM_INVITE');
      expect(result.meta).toEqual({ page: 1, per_page: 20, total: 2, total_pages: 1 });
    });

    it('should return empty page when user has no notifications', async () => {
      mockNotification.count.mockResolvedValue(0);
      mockNotification.findMany.mockResolvedValue([]);

      const result = await service.findAll('user-1', { page: 1, per_page: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('dismiss', () => {
    it('should dismiss a notification owned by the user', async () => {
      mockNotification.findUnique.mockResolvedValue(mockN());
      mockNotification.update.mockResolvedValue(mockN({ dismissed: true }));

      const result = await service.dismiss('notif-1', 'user-1');

      expect(mockNotification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { dismissed: true },
      });
      expect(result.dismissed).toBe(true);
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      mockNotification.findUnique.mockResolvedValue(null);

      await expect(service.dismiss('notif-999', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when notification belongs to another user', async () => {
      mockNotification.findUnique.mockResolvedValue(mockN({ userId: 'user-2' }));

      await expect(service.dismiss('notif-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markRead', () => {
    it('should set readAt on the notification', async () => {
      mockNotification.findUnique.mockResolvedValue(mockN());
      mockNotification.update.mockResolvedValue(mockN({ readAt: NOW }));

      const result = await service.markRead('notif-1', 'user-1');

      expect(mockNotification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({ readAt: expect.any(Date) }),
      });
      expect(result.readAt).toBe(NOW.toISOString());
    });

    it('should not overwrite existing readAt', async () => {
      const existingRead = new Date('2025-12-31T00:00:00Z');
      mockNotification.findUnique.mockResolvedValue(mockN({ readAt: existingRead }));
      mockNotification.update.mockResolvedValue(mockN({ readAt: existingRead }));

      await service.markRead('notif-1', 'user-1');

      expect(mockNotification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { readAt: existingRead },
      });
    });

    it('should throw NotFoundException for missing notification', async () => {
      mockNotification.findUnique.mockResolvedValue(null);
      await expect(service.markRead('x', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a notification', async () => {
      mockNotification.create.mockResolvedValue(mockN());

      const result = await service.create(
        'user-1',
        'TEAM_INVITE',
        'Team Invitation',
        'You have been invited to join Team Alpha'
      );

      expect(mockNotification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'TEAM_INVITE',
          title: 'Team Invitation',
          content: 'You have been invited to join Team Alpha',
          metadata: undefined,
        },
      });
      expect(result.id).toBe('notif-1');
    });

    it('should pass metadata through to prisma', async () => {
      mockNotification.create.mockResolvedValue(mockN({ metadata: { teamId: 't-1' } }));

      await service.create('user-1', 'TEAM_INVITE', 'T', 'C', { teamId: 't-1' });

      expect(mockNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ metadata: { teamId: 't-1' } }),
      });
    });
  });

  describe('createMany', () => {
    it('returns 0 when input is empty', async () => {
      const count = await service.createMany([]);
      expect(count).toBe(0);
      expect(mockNotification.createMany).not.toHaveBeenCalled();
    });

    it('batches multiple notifications and returns count', async () => {
      mockNotification.createMany.mockResolvedValue({ count: 2 });
      const count = await service.createMany([
        { userId: 'u1', type: 'X', title: 'T', content: 'C' },
        { userId: 'u2', type: 'X', title: 'T', content: 'C', metadata: { a: 1 } },
      ]);

      expect(count).toBe(2);
      expect(mockNotification.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'u1', type: 'X', title: 'T', content: 'C', metadata: undefined },
          { userId: 'u2', type: 'X', title: 'T', content: 'C', metadata: { a: 1 } },
        ],
        skipDuplicates: true,
      });
    });
  });
});
