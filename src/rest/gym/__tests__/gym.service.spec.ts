import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGym = { findUnique: vi.fn() };
const mockGymSlot = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
};
const mockGymSubscription = { findMany: vi.fn() };
const mockGymAvailabilityRule = {
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
};
const mockGymAvailabilityException = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
};
const mockOrganizationMember = { findUnique: vi.fn() };
const mockTeam = { findUnique: vi.fn() };

vi.mock('@/shared/utils', () => ({
  prisma: {
    gym: mockGym,
    gymSlot: mockGymSlot,
    gymSubscription: mockGymSubscription,
    gymAvailabilityRule: mockGymAvailabilityRule,
    gymAvailabilityException: mockGymAvailabilityException,
    organizationMember: mockOrganizationMember,
    team: mockTeam,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        gymAvailabilityRule: mockGymAvailabilityRule,
      }),
  },
  redis: {},
  redisSub: {},
}));

const { GymService } = await import('../gym.service');
const { NotificationService } = await import('@/rest/notification/notification.service');

const NOW = new Date('2026-01-01T00:00:00Z');

describe('GymService', () => {
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

  // ---------------------------------------------------------------------------
  // findEffectiveAvailability
  // ---------------------------------------------------------------------------
  describe('findEffectiveAvailability', () => {
    it('rejects invalid range', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1' });
      await expect(
        service.findEffectiveAvailability('g-1', {
          from: '2026-01-02T00:00:00Z',
          to: '2026-01-01T00:00:00Z',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects ranges over the cap', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1' });
      await expect(
        service.findEffectiveAvailability('g-1', {
          from: '2026-01-01T00:00:00Z',
          to: '2026-12-31T00:00:00Z',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('expands a single rule into AVAILABLE segments and clips to range', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1' });
      // 2026-01-05 is a Monday → domain dayOfWeek=0
      mockGymAvailabilityRule.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '12:00', isOpen: true },
      ]);
      mockGymAvailabilityException.findMany.mockResolvedValue([]);
      mockGymSlot.findMany.mockResolvedValue([]);

      const result = await service.findEffectiveAvailability('g-1', {
        from: '2026-01-05T00:00:00Z',
        to: '2026-01-06T00:00:00Z',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startsAt: '2026-01-05T08:00:00.000Z',
        endsAt: '2026-01-05T12:00:00.000Z',
        status: 'AVAILABLE',
        source: 'RULE',
        slotId: null,
        reservedByTeamId: null,
        note: null,
      });
    });

    it('subtracts a closed rule sub-window from the open rule', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1' });
      mockGymAvailabilityRule.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '17:00', isOpen: true },
        { dayOfWeek: 0, startTime: '12:00', endTime: '13:00', isOpen: false },
      ]);
      mockGymAvailabilityException.findMany.mockResolvedValue([]);
      mockGymSlot.findMany.mockResolvedValue([]);

      const result = await service.findEffectiveAvailability('g-1', {
        from: '2026-01-05T00:00:00Z',
        to: '2026-01-06T00:00:00Z',
      });

      expect(result).toHaveLength(2);
      expect(result[0].endsAt).toBe('2026-01-05T12:00:00.000Z');
      expect(result[1].startsAt).toBe('2026-01-05T13:00:00.000Z');
    });

    it('honors a full-day closure exception', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1' });
      mockGymAvailabilityRule.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '17:00', isOpen: true },
      ]);
      mockGymAvailabilityException.findMany.mockResolvedValue([
        { date: new Date('2026-01-05T00:00:00Z'), isClosed: true, startTime: null, endTime: null },
      ]);
      mockGymSlot.findMany.mockResolvedValue([]);

      const result = await service.findEffectiveAvailability('g-1', {
        from: '2026-01-05T00:00:00Z',
        to: '2026-01-06T00:00:00Z',
      });

      expect(result).toHaveLength(0);
    });

    it('honors a partial-day exception override', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1' });
      mockGymAvailabilityRule.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '17:00', isOpen: true },
      ]);
      mockGymAvailabilityException.findMany.mockResolvedValue([
        {
          date: new Date('2026-01-05T00:00:00Z'),
          isClosed: false,
          startTime: '10:00',
          endTime: '11:00',
        },
      ]);
      mockGymSlot.findMany.mockResolvedValue([]);

      const result = await service.findEffectiveAvailability('g-1', {
        from: '2026-01-05T00:00:00Z',
        to: '2026-01-06T00:00:00Z',
      });

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('EXCEPTION');
      expect(result[0].startsAt).toBe('2026-01-05T10:00:00.000Z');
      expect(result[0].endsAt).toBe('2026-01-05T11:00:00.000Z');
    });

    it('subtracts concrete reservations from open windows', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1' });
      mockGymAvailabilityRule.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '17:00', isOpen: true },
      ]);
      mockGymAvailabilityException.findMany.mockResolvedValue([]);
      mockGymSlot.findMany.mockResolvedValue([
        {
          id: 's-1',
          gymId: 'g-1',
          startsAt: new Date('2026-01-05T10:00:00Z'),
          endsAt: new Date('2026-01-05T11:00:00Z'),
          status: 'RESERVED',
          reservedByTeamId: 'team-1',
          note: null,
        },
      ]);

      const result = await service.findEffectiveAvailability('g-1', {
        from: '2026-01-05T00:00:00Z',
        to: '2026-01-06T00:00:00Z',
      });

      const reserved = result.filter((s) => s.status === 'RESERVED');
      const available = result.filter((s) => s.status === 'AVAILABLE');
      expect(reserved).toHaveLength(1);
      expect(reserved[0].slotId).toBe('s-1');
      expect(available).toHaveLength(2);
      expect(available[0].endsAt).toBe('2026-01-05T10:00:00.000Z');
      expect(available[1].startsAt).toBe('2026-01-05T11:00:00.000Z');
    });
  });

  // ---------------------------------------------------------------------------
  // createReservation
  // ---------------------------------------------------------------------------
  describe('createReservation', () => {
    const okQuery = {
      startsAt: '2026-01-05T09:00:00Z',
      endsAt: '2026-01-05T10:00:00Z',
      teamId: 'team-1',
    };

    it('rejects when gym missing', async () => {
      mockGym.findUnique.mockResolvedValue(null);
      await expect(service.createReservation('g-1', okQuery, 'u-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects when team missing', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockTeam.findUnique.mockResolvedValue(null);
      await expect(service.createReservation('g-1', okQuery, 'u-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects when user is not the team captain', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockTeam.findUnique.mockResolvedValue({ id: 'team-1', captainId: 'someone-else' });
      await expect(service.createReservation('g-1', okQuery, 'u-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('rejects when window is outside open hours', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockTeam.findUnique.mockResolvedValue({ id: 'team-1', captainId: 'u-1' });
      mockGymAvailabilityRule.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '17:00', isOpen: true },
      ]);
      mockGymAvailabilityException.findMany.mockResolvedValue([]);
      await expect(
        service.createReservation(
          'g-1',
          {
            ...okQuery,
            startsAt: '2026-01-05T20:00:00Z',
            endsAt: '2026-01-05T21:00:00Z',
          },
          'u-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when window overlaps existing reservation', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockTeam.findUnique.mockResolvedValue({ id: 'team-1', captainId: 'u-1' });
      mockGymAvailabilityRule.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '17:00', isOpen: true },
      ]);
      mockGymAvailabilityException.findMany.mockResolvedValue([]);
      mockGymSlot.findFirst.mockResolvedValue({ id: 's-existing', status: 'RESERVED' });

      await expect(service.createReservation('g-1', okQuery, 'u-1')).rejects.toThrow(
        ConflictException
      );
    });

    it('creates a RESERVED slot and notifies subscribers', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockTeam.findUnique.mockResolvedValue({ id: 'team-1', captainId: 'u-1' });
      mockGymAvailabilityRule.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '17:00', isOpen: true },
      ]);
      mockGymAvailabilityException.findMany.mockResolvedValue([]);
      mockGymSlot.findFirst.mockResolvedValue(null);
      mockGymSlot.create.mockResolvedValue({
        id: 's-new',
        gymId: 'g-1',
        startsAt: new Date('2026-01-05T09:00:00Z'),
        endsAt: new Date('2026-01-05T10:00:00Z'),
        status: 'RESERVED',
        reservedByTeamId: 'team-1',
        note: null,
      });
      mockGymSubscription.findMany.mockResolvedValue([{ userId: 'u-sub-1' }]);

      const result = await service.createReservation('g-1', okQuery, 'u-1');
      expect(result.id).toBe('s-new');
      expect(result.status).toBe('RESERVED');
      expect(mockGymSlot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gymId: 'g-1',
            status: 'RESERVED',
            reservedByTeamId: 'team-1',
            updatedById: 'u-1',
          }),
        })
      );
      expect(notificationService.createMany).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // cancelReservation
  // ---------------------------------------------------------------------------
  describe('cancelReservation', () => {
    it('rejects when slot missing', async () => {
      mockGymSlot.findUnique.mockResolvedValue(null);
      await expect(service.cancelReservation('g-1', 's-1', 'u-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects when slot is not a reservation', async () => {
      mockGymSlot.findUnique.mockResolvedValue({
        id: 's-1',
        gymId: 'g-1',
        status: 'CLOSED',
        reservedByTeamId: null,
        startsAt: NOW,
        endsAt: NOW,
        gym: { organizationId: 'org-1' },
      });
      await expect(service.cancelReservation('g-1', 's-1', 'u-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('allows the reserving team captain', async () => {
      mockGymSlot.findUnique.mockResolvedValue({
        id: 's-1',
        gymId: 'g-1',
        status: 'RESERVED',
        reservedByTeamId: 'team-1',
        startsAt: NOW,
        endsAt: NOW,
        gym: { organizationId: 'org-1' },
      });
      mockTeam.findUnique.mockResolvedValue({ captainId: 'u-1' });
      mockGymSubscription.findMany.mockResolvedValue([]);

      await service.cancelReservation('g-1', 's-1', 'u-1');
      expect(mockGymSlot.delete).toHaveBeenCalledWith({ where: { id: 's-1' } });
    });

    it('allows org STAFF to override-cancel', async () => {
      mockGymSlot.findUnique.mockResolvedValue({
        id: 's-1',
        gymId: 'g-1',
        status: 'RESERVED',
        reservedByTeamId: 'team-1',
        startsAt: NOW,
        endsAt: NOW,
        gym: { organizationId: 'org-1' },
      });
      mockTeam.findUnique.mockResolvedValue({ captainId: 'someone-else' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      mockGymSubscription.findMany.mockResolvedValue([]);

      await service.cancelReservation('g-1', 's-1', 'u-1');
      expect(mockGymSlot.delete).toHaveBeenCalled();
    });

    it('rejects an unrelated user', async () => {
      mockGymSlot.findUnique.mockResolvedValue({
        id: 's-1',
        gymId: 'g-1',
        status: 'RESERVED',
        reservedByTeamId: 'team-1',
        startsAt: NOW,
        endsAt: NOW,
        gym: { organizationId: 'org-1' },
      });
      mockTeam.findUnique.mockResolvedValue({ captainId: 'someone-else' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
      await expect(service.cancelReservation('g-1', 's-1', 'u-1')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // ---------------------------------------------------------------------------
  // createClosure / removeClosure
  // ---------------------------------------------------------------------------
  describe('createClosure', () => {
    const closureDto = { startsAt: '2026-01-05T09:00:00Z', endsAt: '2026-01-05T10:00:00Z' };

    it('rejects org MEMBER', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
      await expect(service.createClosure('g-1', closureDto, 'u-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('creates CLOSED slot for staff', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      mockGymSlot.findFirst.mockResolvedValue(null);
      mockGymSlot.create.mockResolvedValue({
        id: 's-1',
        gymId: 'g-1',
        startsAt: new Date(closureDto.startsAt),
        endsAt: new Date(closureDto.endsAt),
        status: 'CLOSED',
        reservedByTeamId: null,
        note: null,
      });
      mockGymSubscription.findMany.mockResolvedValue([]);

      const result = await service.createClosure('g-1', closureDto, 'u-1');
      expect(result.status).toBe('CLOSED');
    });
  });

  describe('removeClosure', () => {
    it('rejects when slot is not CLOSED', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
      mockGymSlot.findUnique.mockResolvedValue({
        id: 's-1',
        gymId: 'g-1',
        status: 'RESERVED',
        startsAt: NOW,
        endsAt: NOW,
      });
      await expect(service.removeClosure('g-1', 's-1', 'u-1')).rejects.toThrow(BadRequestException);
    });

    it('deletes a CLOSED slot for admin', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
      mockGymSlot.findUnique.mockResolvedValue({
        id: 's-1',
        gymId: 'g-1',
        status: 'CLOSED',
        startsAt: NOW,
        endsAt: NOW,
      });
      mockGymSubscription.findMany.mockResolvedValue([]);

      await service.removeClosure('g-1', 's-1', 'u-1');
      expect(mockGymSlot.delete).toHaveBeenCalledWith({ where: { id: 's-1' } });
    });
  });

  // ---------------------------------------------------------------------------
  // Schedule management — replaceRules / createException / removeException
  // ---------------------------------------------------------------------------
  describe('replaceRules', () => {
    it('rejects org MEMBER', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
      await expect(service.replaceRules('g-1', { rules: [] }, 'u-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('rejects overlapping rules', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      await expect(
        service.replaceRules(
          'g-1',
          {
            rules: [
              { dayOfWeek: 0, startTime: '08:00', endTime: '12:00', isOpen: true },
              { dayOfWeek: 0, startTime: '11:00', endTime: '13:00', isOpen: true },
            ],
          },
          'u-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('replaces rules in a transaction', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      mockGymAvailabilityRule.deleteMany.mockResolvedValue({ count: 1 });
      mockGymAvailabilityRule.createMany.mockResolvedValue({ count: 1 });
      mockGymAvailabilityRule.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '12:00', isOpen: true },
      ]);

      const result = await service.replaceRules(
        'g-1',
        { rules: [{ dayOfWeek: 0, startTime: '08:00', endTime: '12:00', isOpen: true }] },
        'u-1'
      );
      expect(mockGymAvailabilityRule.deleteMany).toHaveBeenCalled();
      expect(mockGymAvailabilityRule.createMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('createException', () => {
    it('requires startTime+endTime when not closed', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      await expect(
        service.createException('g-1', { date: '2026-01-05', isClosed: false }, 'u-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a closure exception', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      mockGymAvailabilityException.create.mockResolvedValue({
        id: 'e-1',
        gymId: 'g-1',
        date: new Date('2026-01-05T00:00:00Z'),
        isClosed: true,
        startTime: null,
        endTime: null,
        note: 'Holiday',
      });

      const result = await service.createException(
        'g-1',
        { date: '2026-01-05', isClosed: true, note: 'Holiday' },
        'u-1'
      );
      expect(result.isClosed).toBe(true);
      expect(result.note).toBe('Holiday');
    });
  });

  describe('removeException', () => {
    it('rejects when exception missing', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      mockGymAvailabilityException.findUnique.mockResolvedValue(null);
      await expect(service.removeException('g-1', 'e-1', 'u-1')).rejects.toThrow(NotFoundException);
    });

    it('deletes', async () => {
      mockGym.findUnique.mockResolvedValue({ id: 'g-1', organizationId: 'org-1' });
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      mockGymAvailabilityException.findUnique.mockResolvedValue({ id: 'e-1', gymId: 'g-1' });
      await service.removeException('g-1', 'e-1', 'u-1');
      expect(mockGymAvailabilityException.delete).toHaveBeenCalledWith({ where: { id: 'e-1' } });
    });
  });
});
