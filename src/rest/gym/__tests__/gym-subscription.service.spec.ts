import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGym = { findUnique: vi.fn() };
const mockGymSubscription = {
  upsert: vi.fn(),
  findUnique: vi.fn(),
  delete: vi.fn(),
  findMany: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: { gym: mockGym, gymSubscription: mockGymSubscription },
  redis: {},
  redisSub: {},
}));

const { GymSubscriptionService } = await import('../gym-subscription.service');

const NOW = new Date('2026-01-01T00:00:00Z');

describe('GymSubscriptionService', () => {
  let service: InstanceType<typeof GymSubscriptionService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [GymSubscriptionService],
    }).compile();
    service = module.get(GymSubscriptionService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('subscribe', () => {
    it('rejects missing gym', async () => {
      mockGym.findUnique.mockResolvedValue(null);
      await expect(service.subscribe('u-1', 'g-x')).rejects.toThrow(NotFoundException);
    });

    it('upserts subscription and returns record', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1' });
      mockGymSubscription.upsert.mockResolvedValue({
        id: 's-1',
        userId: 'u-1',
        gymId: 'g-1',
        createdAt: NOW,
      });

      const result = await service.subscribe('u-1', 'g-1');
      expect(result.gymId).toBe('g-1');
    });
  });

  describe('unsubscribe', () => {
    it('rejects missing subscription', async () => {
      mockGymSubscription.findUnique.mockResolvedValue(null);
      await expect(service.unsubscribe('u-1', 'g-1')).rejects.toThrow(NotFoundException);
    });

    it('deletes the subscription', async () => {
      mockGymSubscription.findUnique.mockResolvedValue({ id: 's-1' });
      await service.unsubscribe('u-1', 'g-1');
      expect(mockGymSubscription.delete).toHaveBeenCalledWith({ where: { id: 's-1' } });
    });
  });

  describe('listForUser', () => {
    it('returns subscriptions sorted desc', async () => {
      mockGymSubscription.findMany.mockResolvedValue([
        { id: 's-1', userId: 'u-1', gymId: 'g-1', createdAt: NOW },
      ]);
      const result = await service.listForUser('u-1');
      expect(result).toHaveLength(1);
    });
  });
});
