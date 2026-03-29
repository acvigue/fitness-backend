import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotification = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
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
    it('should return all notifications for a user', async () => {
      mockNotification.findMany.mockResolvedValue([mockN(), mockN({ id: 'notif-2' })]);

      const result = await service.findAll('user-1');

      expect(mockNotification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('notif-1');
      expect(result[0].type).toBe('TEAM_INVITE');
    });

    it('should return empty array when user has no notifications', async () => {
      mockNotification.findMany.mockResolvedValue([]);

      const result = await service.findAll('user-1');

      expect(result).toEqual([]);
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
        },
      });
      expect(result.id).toBe('notif-1');
    });
  });
});
