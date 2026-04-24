import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEngagementEvent = {
  findFirst: vi.fn(),
  create: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: { engagementEvent: mockEngagementEvent },
  redis: {},
  redisSub: {},
}));

const { EngagementService } = await import('../engagement.service');
const { AchievementService } = await import('@/rest/achievement/achievement.service');
const { EngagementType } = await import('@/generated/prisma/enums');

describe('EngagementService', () => {
  let service: InstanceType<typeof EngagementService>;
  const mockAchievementService = { incrementProgress: vi.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EngagementService,
        { provide: AchievementService, useValue: mockAchievementService },
      ],
    }).compile();
    service = module.get(EngagementService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngagementEvent.findFirst.mockResolvedValue(null);
    mockEngagementEvent.create.mockResolvedValue({ id: 'e-1' });
  });

  describe('trackEvent', () => {
    it('rejects mismatched authenticated user', async () => {
      await expect(
        service.trackEvent({ userId: 'u-1', type: EngagementType.MESSAGE_SENT }, 'u-2')
      ).rejects.toThrow(ForbiddenException);
    });

    it('delegates to recordEvent on match', async () => {
      await service.trackEvent({ userId: 'u-1', type: EngagementType.MESSAGE_SENT }, 'u-1');
      expect(mockEngagementEvent.create).toHaveBeenCalled();
    });
  });

  describe('recordEvent', () => {
    it('creates a countable event every call (MESSAGE_SENT)', async () => {
      await service.recordEvent({ userId: 'u-1', type: EngagementType.MESSAGE_SENT });
      expect(mockEngagementEvent.findFirst).not.toHaveBeenCalled();
      expect(mockEngagementEvent.create).toHaveBeenCalled();
    });

    it('dedupes non-countable events (CHAT_CREATED same chat)', async () => {
      mockEngagementEvent.findFirst.mockResolvedValue({ id: 'existing' });
      await service.recordEvent({
        userId: 'u-1',
        type: EngagementType.CHAT_CREATED,
        chatId: 'c-1',
      });
      expect(mockEngagementEvent.create).not.toHaveBeenCalled();
    });

    it('triggers achievement progress increment', async () => {
      await service.recordEvent({ userId: 'u-1', type: EngagementType.MESSAGE_SENT });
      await new Promise((r) => setImmediate(r));
      expect(mockAchievementService.incrementProgress).toHaveBeenCalledWith(
        'u-1',
        EngagementType.MESSAGE_SENT
      );
    });
  });
});
