import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockAchievementDefinition = {
  create: vi.fn(),
  findMany: vi.fn(),
};

const mockUserAchievement = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    achievementDefinition: mockAchievementDefinition,
    userAchievement: mockUserAchievement,
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        achievementDefinition: mockAchievementDefinition,
        userAchievement: mockUserAchievement,
      })
    ),
  },
  redis: {},
  redisSub: {},
}));

const { AchievementService } = await import('../achievement.service');
const { NotificationService } = await import('../../notification/notification.service');

const mockNotificationService = {
  create: vi.fn().mockResolvedValue({}),
};

const NOW = new Date('2026-01-01T00:00:00Z');

function mockDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: 'def-1',
    name: 'First Tournament',
    description: 'Participate in your first tournament',
    icon: null,
    criteriaType: 'TOURNAMENT_PARTICIPATION',
    threshold: 1,
    ...overrides,
  };
}

describe('AchievementService', () => {
  let service: InstanceType<typeof AchievementService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AchievementService,
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(AchievementService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDefinition', () => {
    it('should create an achievement definition', async () => {
      mockAchievementDefinition.create.mockResolvedValue(mockDefinition());

      const result = await service.createDefinition({
        name: 'First Tournament',
        description: 'Participate in your first tournament',
        criteriaType: 'TOURNAMENT_PARTICIPATION',
        threshold: 1,
      });

      expect(result.name).toBe('First Tournament');
      expect(result.criteriaType).toBe('TOURNAMENT_PARTICIPATION');
      expect(result.threshold).toBe(1);
    });
  });

  describe('listDefinitions', () => {
    it('should return all definitions sorted by name', async () => {
      mockAchievementDefinition.findMany.mockResolvedValue([
        mockDefinition(),
        mockDefinition({ id: 'def-2', name: 'Veteran', threshold: 10 }),
      ]);

      const result = await service.listDefinitions();

      expect(result).toHaveLength(2);
      expect(mockAchievementDefinition.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getUserAchievements', () => {
    it('should return user achievements with definitions', async () => {
      mockUserAchievement.findMany.mockResolvedValue([
        {
          id: 'ua-1',
          progress: 1,
          unlockedAt: NOW,
          createdAt: NOW,
          achievement: mockDefinition(),
        },
      ]);

      const result = await service.getUserAchievements('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].progress).toBe(1);
      expect(result[0].unlockedAt).toBe(NOW.toISOString());
      expect(result[0].achievement.name).toBe('First Tournament');
    });
  });

  describe('getAllAchievementsForUser', () => {
    it('should return all definitions with user progress', async () => {
      mockAchievementDefinition.findMany.mockResolvedValue([
        mockDefinition(),
        mockDefinition({ id: 'def-2', name: 'Veteran', threshold: 5 }),
      ]);
      mockUserAchievement.findMany.mockResolvedValue([
        {
          id: 'ua-1',
          achievementId: 'def-1',
          progress: 1,
          unlockedAt: NOW,
          achievement: mockDefinition(),
        },
      ]);

      const result = await service.getAllAchievementsForUser('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].progress).toBe(1);
      expect(result[0].unlockedAt).toBe(NOW.toISOString());
      expect(result[1].id).toBeNull();
      expect(result[1].progress).toBe(0);
      expect(result[1].unlockedAt).toBeNull();
    });
  });

  describe('getLockedAchievements', () => {
    it('should return only locked achievements', async () => {
      mockAchievementDefinition.findMany.mockResolvedValue([
        mockDefinition(),
        mockDefinition({ id: 'def-2', name: 'Veteran', threshold: 5 }),
      ]);
      mockUserAchievement.findMany.mockResolvedValue([
        {
          id: 'ua-1',
          achievementId: 'def-1',
          progress: 1,
          unlockedAt: NOW,
          achievement: mockDefinition(),
        },
      ]);

      const result = await service.getLockedAchievements('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].achievement.name).toBe('Veteran');
      expect(result[0].progress).toBe(0);
      expect(result[0].unlockedAt).toBeNull();
    });

    it('should include partially progressed but not unlocked achievements', async () => {
      mockAchievementDefinition.findMany.mockResolvedValue([
        mockDefinition({ id: 'def-1', threshold: 5 }),
      ]);
      mockUserAchievement.findMany.mockResolvedValue([
        {
          id: 'ua-1',
          achievementId: 'def-1',
          progress: 3,
          unlockedAt: null,
          achievement: mockDefinition({ threshold: 5 }),
        },
      ]);

      const result = await service.getLockedAchievements('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].progress).toBe(3);
      expect(result[0].unlockedAt).toBeNull();
    });
  });

  describe('incrementProgress', () => {
    it('should create new progress entry and unlock when threshold reached', async () => {
      mockAchievementDefinition.findMany.mockResolvedValue([mockDefinition({ threshold: 1 })]);
      mockUserAchievement.findUnique.mockResolvedValue(null);
      mockUserAchievement.upsert.mockResolvedValue({});

      await service.incrementProgress('user-1', 'TOURNAMENT_PARTICIPATION');

      expect(mockUserAchievement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            progress: 1,
            unlockedAt: expect.any(Date),
          }),
        })
      );
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'user-1',
        'ACHIEVEMENT_UNLOCKED',
        'Achievement Unlocked!',
        expect.stringContaining('First Tournament')
      );
    });

    it('should increment existing progress without unlocking', async () => {
      mockAchievementDefinition.findMany.mockResolvedValue([mockDefinition({ threshold: 5 })]);
      mockUserAchievement.findUnique.mockResolvedValue({
        progress: 2,
        unlockedAt: null,
      });
      mockUserAchievement.upsert.mockResolvedValue({});

      await service.incrementProgress('user-1', 'TOURNAMENT_PARTICIPATION');

      expect(mockUserAchievement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            progress: 3,
            unlockedAt: null,
          }),
        })
      );
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });

    it('should skip already unlocked achievements', async () => {
      mockAchievementDefinition.findMany.mockResolvedValue([mockDefinition()]);
      mockUserAchievement.findUnique.mockResolvedValue({
        progress: 1,
        unlockedAt: NOW,
      });

      await service.incrementProgress('user-1', 'TOURNAMENT_PARTICIPATION');

      expect(mockUserAchievement.upsert).not.toHaveBeenCalled();
    });

    it('should handle multiple tier definitions', async () => {
      mockAchievementDefinition.findMany.mockResolvedValue([
        mockDefinition({ id: 'def-1', threshold: 1 }),
        mockDefinition({ id: 'def-2', name: 'Veteran', threshold: 5 }),
      ]);
      mockUserAchievement.findUnique
        .mockResolvedValueOnce({ progress: 0, unlockedAt: NOW }) // def-1 already unlocked
        .mockResolvedValueOnce({ progress: 4, unlockedAt: null }); // def-2 at 4/5
      mockUserAchievement.upsert.mockResolvedValue({});

      await service.incrementProgress('user-1', 'TOURNAMENT_PARTICIPATION');

      // Should skip def-1 (already unlocked), increment def-2
      expect(mockUserAchievement.upsert).toHaveBeenCalledTimes(1);
      expect(mockUserAchievement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ progress: 5 }),
        })
      );
    });

    it('should use a transaction for all progress updates', async () => {
      const { prisma } = await import('@/shared/utils');
      mockAchievementDefinition.findMany.mockResolvedValue([mockDefinition({ threshold: 1 })]);
      mockUserAchievement.findUnique.mockResolvedValue(null);
      mockUserAchievement.upsert.mockResolvedValue({});

      await service.incrementProgress('user-1', 'TOURNAMENT_PARTICIPATION');

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
