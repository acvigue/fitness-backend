import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGym = { findUnique: vi.fn() };
const mockGymSlot = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};
const mockGymSubscription = { findMany: vi.fn() };
const mockOrganizationMember = { findUnique: vi.fn() };
const mockTeam = { findMany: vi.fn() };

vi.mock('@/shared/utils', () => ({
  prisma: {
    gym: mockGym,
    gymSlot: mockGymSlot,
    gymSubscription: mockGymSubscription,
    organizationMember: mockOrganizationMember,
    team: mockTeam,
  },
  redis: {},
  redisSub: {},
}));

const { GymService } = await import('../gym.service');
const { NotificationService } = await import('@/rest/notification/notification.service');

const NOW = new Date('2026-01-01T00:00:00Z');

describe('GymService (slots + subscriptions)', () => {
  let service: InstanceType<typeof GymService>;
  const notificationService = { createMany: vi.fn().mockResolvedValue(0) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [GymService, { provide: NotificationService, useValue: notificationService }],
    }).compile();
    service = module.get(GymService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listSlots', () => {
    it('filters by gymId, status, from, to', async () => {
      mockGymSlot.findMany.mockResolvedValue([]);
      await service.listSlots({
        gymId: 'gym-1',
        status: 'AVAILABLE',
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-02T00:00:00Z',
      });

      expect(mockGymSlot.findMany).toHaveBeenCalledWith({
        where: {
          gymId: 'gym-1',
          status: 'AVAILABLE',
          startsAt: { gte: new Date('2026-01-01T00:00:00Z'), lt: new Date('2026-01-02T00:00:00Z') },
        },
        orderBy: [{ startsAt: 'asc' }],
      });
    });

    it('returns mapped slots', async () => {
      mockGymSlot.findMany.mockResolvedValue([
        {
          id: 's-1',
          gymId: 'g-1',
          startsAt: NOW,
          endsAt: NOW,
          status: 'AVAILABLE',
          reservedByTeamId: null,
          note: null,
        },
      ]);

      const result = await service.listSlots({});
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('AVAILABLE');
    });
  });

  describe('createSlot', () => {
    it('throws 404 if gym missing', async () => {
      mockGym.findUnique.mockResolvedValue(null);
      await expect(
        service.createSlot(
          'g-1',
          { startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-01T01:00:00Z' },
          'u-1'
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects non-member', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue(null);
      await expect(
        service.createSlot(
          'g-1',
          { startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-01T01:00:00Z' },
          'u-1'
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when endsAt not after startsAt', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ id: 'm-1' });
      await expect(
        service.createSlot(
          'g-1',
          { startsAt: '2026-01-01T01:00:00Z', endsAt: '2026-01-01T01:00:00Z' },
          'u-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('creates slot when valid', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ id: 'm-1' });
      mockGymSlot.create.mockResolvedValue({
        id: 's-1',
        gymId: 'g-1',
        startsAt: NOW,
        endsAt: NOW,
        status: 'AVAILABLE',
        reservedByTeamId: null,
        note: null,
      });
      mockGymSubscription.findMany.mockResolvedValue([]);

      const result = await service.createSlot(
        'g-1',
        { startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-01T01:00:00Z' },
        'u-1'
      );
      expect(result.id).toBe('s-1');
    });

    it('notifies subscribers when slot is created', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ id: 'm-1' });
      mockGymSlot.create.mockResolvedValue({
        id: 's-1',
        gymId: 'g-1',
        startsAt: NOW,
        endsAt: NOW,
        status: 'AVAILABLE',
        reservedByTeamId: null,
        note: null,
      });
      mockGymSubscription.findMany.mockResolvedValue([{ userId: 'u-sub-1' }]);

      await service.createSlot(
        'g-1',
        { startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-01T01:00:00Z' },
        'u-1'
      );

      expect(notificationService.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'u-sub-1', type: 'GYM_STATUS_CHANGED' }),
      ]);
    });
  });

  describe('updateSlotStatus', () => {
    it('rejects when user has no captainship', async () => {
      mockGymSlot.findUnique.mockResolvedValue({ id: 's-1', gymId: 'g-1' });
      mockTeam.findMany.mockResolvedValue([]);

      await expect(
        service.updateSlotStatus('g-1', 's-1', { status: 'RESERVED' }, 'u-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when specified team does not match captainship', async () => {
      mockGymSlot.findUnique.mockResolvedValue({ id: 's-1', gymId: 'g-1' });
      mockTeam.findMany.mockResolvedValue([{ id: 'team-2' }]);

      await expect(
        service.updateSlotStatus(
          'g-1',
          's-1',
          { status: 'RESERVED', reservedByTeamId: 'team-1' },
          'u-1'
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates status and dispatches notifications to subscribers', async () => {
      mockGymSlot.findUnique.mockResolvedValue({ id: 's-1', gymId: 'g-1' });
      mockTeam.findMany.mockResolvedValue([{ id: 'team-1' }]);
      mockGymSlot.update.mockResolvedValue({
        id: 's-1',
        gymId: 'g-1',
        startsAt: NOW,
        endsAt: NOW,
        status: 'RESERVED',
        reservedByTeamId: 'team-1',
        note: 'held',
      });
      mockGymSubscription.findMany.mockResolvedValue([
        { userId: 'u-sub-1' },
        { userId: 'u-sub-2' },
      ]);

      const result = await service.updateSlotStatus(
        'g-1',
        's-1',
        { status: 'RESERVED', reservedByTeamId: 'team-1', note: 'held' },
        'u-1'
      );

      expect(result.status).toBe('RESERVED');
      expect(notificationService.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'u-sub-1', type: 'GYM_STATUS_CHANGED' }),
        expect.objectContaining({ userId: 'u-sub-2' }),
      ]);
    });

    it('rejects when slot does not belong to gym', async () => {
      mockGymSlot.findUnique.mockResolvedValue({ id: 's-1', gymId: 'other-gym' });
      await expect(
        service.updateSlotStatus('g-1', 's-1', { status: 'CLOSED' }, 'u-1')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
