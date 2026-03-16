import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';

const mockUserModel = {
  findUnique: vi.fn(),
};

const mockAchievementModel = {
  create: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    user: mockUserModel,
    report: mockAchievementModel,
  },
  redis: {},
  redisSub: {},
}));

const { AchievementService } = await import('../achievement.service');

const NOW = new Date('2026-01-01T00:00:00Z');

describe('AchievementService', () => {
  let service: InstanceType<typeof AchievementService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [AchievementService],
    }).compile();

    service = module.get(AchievementService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('create', () => {
    it('Should create a achievement and return ', async () => {
      mockUserModel.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Reported' });
      mockAchievementModel.findFirst.mockResolvedValueOnce(null);
      mockAchievementModel.create.mockResolvedValue({
        id: 'achievement-1',
        userId: 'user-1',
        title: 'title',
        description: 'description',
        earnedAt: NOW,
      });
      const result = await service.create({ title: 'title', description: 'description' }, 'user-1');

      expect(result).toEqual({
        title: 'title',
        description: 'description',
      });
    });
    it('should throw NotFoundException when reported user does not exist', async () => {
      mockUserModel.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create({ title: 'title', description: 'description' }, 'missing')
      ).rejects.toThrow(NotFoundException);

      expect(mockAchievementModel.create).not.toHaveBeenCalled();
    });
  });
  describe('get', () => {
    it('Should get achievements for a user', async () => {
      mockAchievementModel.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          title: 'Title',
          description: 'Description',
          earnedAt: NOW,
        },
      ]);

      const result = await service.get('user-1');

      expect(result).toEqual([
        {
          userId: 'user-1',
          title: 'Title',
          description: 'Description',
          earnedAt: NOW,
        },
      ]);
    });
  });
});
