import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockTeam = { findUnique: vi.fn() };
const mockBroadcast = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
};
const mockBroadcastReceipt = {
  createMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    team: mockTeam,
    broadcast: mockBroadcast,
    broadcastReceipt: mockBroadcastReceipt,
  },
  redis: {},
  redisSub: {},
}));

const { BroadcastService } = await import('../broadcast.service');
const { NotificationService } = await import('@/rest/notification/notification.service');

const NOW = new Date('2026-01-01T00:00:00Z');

describe('BroadcastService', () => {
  let service: InstanceType<typeof BroadcastService>;
  const notificationService = {
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue(0),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BroadcastService,
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();
    service = module.get(BroadcastService);
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('broadcast', () => {
    it('rejects missing team', async () => {
      mockTeam.findUnique.mockResolvedValue(null);
      await expect(service.broadcast('t-1', { content: 'hi' }, 'u-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects non-captain', async () => {
      mockTeam.findUnique.mockResolvedValue({ id: 't-1', captainId: 'other', users: [] });
      await expect(service.broadcast('t-1', { content: 'hi' }, 'u-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('creates broadcast, receipts, and fan-out notifications', async () => {
      mockTeam.findUnique.mockResolvedValue({
        id: 't-1',
        captainId: 'u-1',
        name: 'Team',
        users: [{ id: 'u-1' }, { id: 'u-2' }, { id: 'u-3' }],
      });
      mockBroadcast.create.mockResolvedValue({
        id: 'b-1',
        teamId: 't-1',
        authorId: 'u-1',
        content: 'hi',
        createdAt: NOW,
      });
      mockBroadcastReceipt.createMany.mockResolvedValue({ count: 3 });

      const result = await service.broadcast('t-1', { content: 'hi' }, 'u-1');

      expect(result.id).toBe('b-1');
      expect(mockBroadcastReceipt.createMany).toHaveBeenCalledWith({
        data: [
          { broadcastId: 'b-1', userId: 'u-1' },
          { broadcastId: 'b-1', userId: 'u-2' },
          { broadcastId: 'b-1', userId: 'u-3' },
        ],
        skipDuplicates: true,
      });
      expect(notificationService.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'u-2' }),
        expect.objectContaining({ userId: 'u-3' }),
      ]);
    });
  });

  describe('markRead', () => {
    it('throws when receipt is missing', async () => {
      mockBroadcastReceipt.findUnique.mockResolvedValue(null);
      await expect(service.markRead('b-1', 'u-1')).rejects.toThrow(NotFoundException);
    });

    it('no-ops when already read', async () => {
      mockBroadcastReceipt.findUnique.mockResolvedValue({ id: 'r-1', readAt: NOW });
      await service.markRead('b-1', 'u-1');
      expect(mockBroadcastReceipt.update).not.toHaveBeenCalled();
    });

    it('updates readAt when unread', async () => {
      mockBroadcastReceipt.findUnique.mockResolvedValue({ id: 'r-1', readAt: null });
      await service.markRead('b-1', 'u-1');
      expect(mockBroadcastReceipt.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('getStats', () => {
    it('rejects non-captain', async () => {
      mockBroadcast.findUnique.mockResolvedValue({
        id: 'b-1',
        team: { captainId: 'other' },
      });
      await expect(service.getStats('b-1', 'u-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns delivery and read counts', async () => {
      mockBroadcast.findUnique.mockResolvedValue({
        id: 'b-1',
        team: { captainId: 'u-1' },
      });
      mockBroadcastReceipt.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);

      const result = await service.getStats('b-1', 'u-1');
      expect(result).toEqual({ broadcastId: 'b-1', delivered: 5, read: 3, total: 5 });
    });
  });

  describe('listForTeam', () => {
    it('rejects non-member non-captain', async () => {
      mockTeam.findUnique.mockResolvedValue({ id: 't-1', captainId: 'other', users: [] });
      await expect(service.listForTeam('t-1', 'u-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns broadcasts for a team member', async () => {
      mockTeam.findUnique.mockResolvedValue({
        id: 't-1',
        captainId: 'other',
        users: [{ id: 'u-1' }],
      });
      mockBroadcast.findMany.mockResolvedValue([
        { id: 'b-1', teamId: 't-1', authorId: 'u-2', content: 'hi', createdAt: NOW },
      ]);
      const result = await service.listForTeam('t-1', 'u-1');
      expect(result).toHaveLength(1);
    });
  });
});
