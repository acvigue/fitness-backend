import { Test } from '@nestjs/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPreference = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};
const mockDispatch = { create: vi.fn() };
const mockTournament = { findMany: vi.fn() };

vi.mock('@/shared/utils', () => ({
  prisma: {
    reminderPreference: mockPreference,
    reminderDispatch: mockDispatch,
    tournament: mockTournament,
  },
  redis: {},
  redisSub: {},
}));

const { ReminderService } = await import('../reminder.service');
const { NotificationService } = await import('@/rest/notification/notification.service');

const NOW = new Date('2026-05-01T12:00:00Z');
const START = new Date('2026-05-01T13:00:00Z'); // 60 min away

describe('ReminderService', () => {
  let service: InstanceType<typeof ReminderService>;
  const notificationService = { create: vi.fn().mockResolvedValue({}) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [ReminderService, { provide: NotificationService, useValue: notificationService }],
    }).compile();
    service = module.get(ReminderService);
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('upsertPreference', () => {
    it('creates a global preference when none exists', async () => {
      mockPreference.findFirst.mockResolvedValue(null);
      mockPreference.create.mockResolvedValue({
        id: 'p-1',
        tournamentId: null,
        intervalsMinutes: [1440, 60],
        updatedAt: NOW,
      });
      const result = await service.upsertPreference('u-1', { intervalsMinutes: [1440, 60] });
      expect(mockPreference.findFirst).toHaveBeenCalledWith({
        where: { userId: 'u-1', tournamentId: null },
      });
      expect(mockPreference.create).toHaveBeenCalledWith({
        data: { userId: 'u-1', tournamentId: null, intervalsMinutes: [1440, 60] },
      });
      expect(result.tournamentId).toBeNull();
    });

    it('updates an existing per-tournament preference', async () => {
      mockPreference.findFirst.mockResolvedValue({
        id: 'p-2',
        tournamentId: 't-1',
        intervalsMinutes: [120],
        updatedAt: NOW,
      });
      mockPreference.update.mockResolvedValue({
        id: 'p-2',
        tournamentId: 't-1',
        intervalsMinutes: [60],
        updatedAt: NOW,
      });
      await service.upsertPreference('u-1', { intervalsMinutes: [60], tournamentId: 't-1' });
      expect(mockPreference.findFirst).toHaveBeenCalledWith({
        where: { userId: 'u-1', tournamentId: 't-1' },
      });
      expect(mockPreference.update).toHaveBeenCalledWith({
        where: { id: 'p-2' },
        data: { intervalsMinutes: [60] },
      });
    });
  });

  describe('resolveIntervalsForUser', () => {
    it('prefers tournament-specific override', async () => {
      mockPreference.findFirst
        .mockResolvedValueOnce({ intervalsMinutes: [30] })
        .mockResolvedValueOnce({ intervalsMinutes: [1440] });
      const result = await service.resolveIntervalsForUser('u-1', 't-1');
      expect(result).toEqual([30]);
    });

    it('falls back to global preference', async () => {
      mockPreference.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ intervalsMinutes: [120] });
      const result = await service.resolveIntervalsForUser('u-1', 't-1');
      expect(result).toEqual([120]);
    });

    it('falls back to defaults when no preference exists', async () => {
      mockPreference.findFirst.mockResolvedValue(null);
      const result = await service.resolveIntervalsForUser('u-1', 't-1');
      expect(result).toEqual([1440, 60]);
    });
  });

  describe('fireRemindersForUser', () => {
    it('fires notifications for all intervals within window', async () => {
      // 60 min from start — both the 1440-min and 60-min reminders apply
      mockPreference.findFirst.mockResolvedValue({ intervalsMinutes: [1440, 60] });
      mockDispatch.create.mockResolvedValue({});

      await service.fireRemindersForUser('u-1', 't-1', 'Cup', START, NOW);

      expect(mockDispatch.create).toHaveBeenCalledTimes(2);
      expect(notificationService.create).toHaveBeenCalledTimes(2);
    });

    it('skips already-dispatched intervals (unique constraint violation)', async () => {
      mockPreference.findFirst.mockResolvedValue({ intervalsMinutes: [60] });
      mockDispatch.create.mockRejectedValue(new Error('unique violation'));

      await service.fireRemindersForUser('u-1', 't-1', 'Cup', START, NOW);

      expect(notificationService.create).not.toHaveBeenCalled();
    });

    it('skips intervals further away than the remaining time', async () => {
      mockPreference.findFirst.mockResolvedValue({ intervalsMinutes: [1440, 60] });
      mockDispatch.create.mockResolvedValue({});

      // 2 days from start — nothing should fire yet (intervals < minutesUntilStart)
      const twoDaysEarly = new Date(START.getTime() - 2 * 24 * 60 * 60 * 1000);
      await service.fireRemindersForUser('u-1', 't-1', 'Cup', START, twoDaysEarly);

      expect(mockDispatch.create).not.toHaveBeenCalled();
    });
  });
});
