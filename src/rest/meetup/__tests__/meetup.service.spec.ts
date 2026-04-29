import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockTeamModel = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
};

const mockMeetupModel = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
};

const mockTeamBlockModel = {
  findFirst: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    team: mockTeamModel,
    meetup: mockMeetupModel,
    teamBlock: mockTeamBlockModel,
  },
  redis: {},
  redisSub: {},
}));

const { TeamBlockService } = await import('../../team-block/team-block.service');
const { NotificationService } = await import('../../notification/notification.service');
const { MeetupService } = await import('../meetup.service');

const NOW = new Date('2026-01-01T00:00:00Z');
const MEETUP_DATE = new Date('2026-05-01T14:00:00Z');

const mockNotificationService = {
  create: vi.fn(),
};

function mockMeetup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'meetup-1',
    proposingTeamId: 'team-1',
    proposingTeam: {
      name: 'Team Alpha',
      captainId: 'captain-1',
      users: [{ id: 'captain-1' }, { id: 'user-2' }],
    },
    receivingTeamId: 'team-2',
    receivingTeam: {
      name: 'Team Beta',
      captainId: 'captain-2',
      users: [{ id: 'captain-2' }, { id: 'user-4' }],
    },
    title: 'Saturday Scrimmage',
    description: null,
    location: 'Central Park',
    dateTime: MEETUP_DATE,
    status: 'PENDING',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('MeetupService', () => {
  let service: InstanceType<typeof MeetupService>;
  let teamBlockService: InstanceType<typeof TeamBlockService>;

  beforeAll(async () => {
    const { EngagementService } = await import('@/rest/engagement/engagement.service');
    const module = await Test.createTestingModule({
      providers: [
        MeetupService,
        TeamBlockService,
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: EngagementService, useValue: { recordEvent: vi.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get(MeetupService);
    teamBlockService = module.get(TeamBlockService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── proposeMeetup ───────────────────────────────────

  describe('proposeMeetup', () => {
    it('should create a meetup and notify receiving captain', async () => {
      mockTeamModel.findUnique
        .mockResolvedValueOnce({ id: 'team-1', users: [{ id: 'captain-1' }] })
        .mockResolvedValueOnce({ id: 'team-2' });
      vi.spyOn(teamBlockService, 'isBlockedEitherWay').mockResolvedValue(false);
      mockMeetupModel.create.mockResolvedValue(mockMeetup());

      const result = await service.proposeMeetup(
        {
          proposingTeamId: 'team-1',
          receivingTeamId: 'team-2',
          title: 'Saturday Scrimmage',
          location: 'Central Park',
          dateTime: '2026-05-01T14:00:00.000Z',
        },
        'captain-1'
      );

      expect(result.title).toBe('Saturday Scrimmage');
      expect(result.status).toBe('PENDING');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'captain-2',
        'MEETUP_PROPOSAL',
        'New Meetup Proposal',
        expect.stringContaining('Saturday Scrimmage')
      );
    });

    it('should throw when teams are blocked', async () => {
      mockTeamModel.findUnique
        .mockResolvedValueOnce({
          id: 'team-1',
          users: [{ id: 'captain-1' }],
        })
        .mockResolvedValueOnce({ id: 'team-2' });
      vi.spyOn(teamBlockService, 'isBlockedEitherWay').mockResolvedValue(true);

      await expect(
        service.proposeMeetup(
          {
            proposingTeamId: 'team-1',
            receivingTeamId: 'team-2',
            title: 'Test',
            location: 'Park',
            dateTime: '2026-05-01T14:00:00.000Z',
          },
          'captain-1'
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw when proposing to own team', async () => {
      await expect(
        service.proposeMeetup(
          {
            proposingTeamId: 'team-1',
            receivingTeamId: 'team-1',
            title: 'Test',
            location: 'Park',
            dateTime: '2026-05-01T14:00:00.000Z',
          },
          'captain-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when user is not a member of proposing team', async () => {
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        users: [{ id: 'captain-1' }],
      });

      await expect(
        service.proposeMeetup(
          {
            proposingTeamId: 'team-1',
            receivingTeamId: 'team-2',
            title: 'Test',
            location: 'Park',
            dateTime: '2026-05-01T14:00:00.000Z',
          },
          'outsider'
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── acceptMeetup ────────────────────────────────────

  describe('acceptMeetup', () => {
    it('should accept a pending meetup', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup());
      mockMeetupModel.update.mockResolvedValue(mockMeetup({ status: 'ACCEPTED' }));

      const result = await service.acceptMeetup('meetup-1', 'captain-2');

      expect(result.status).toBe('ACCEPTED');
      // Should notify members of both teams (excluding the acting captain)
      expect(mockNotificationService.create).toHaveBeenCalled();
    });

    it('should throw when not receiving team captain', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup());

      await expect(service.acceptMeetup('meetup-1', 'captain-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw when meetup is not pending', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup({ status: 'DECLINED' }));

      await expect(service.acceptMeetup('meetup-1', 'captain-2')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ─── declineMeetup ───────────────────────────────────

  describe('declineMeetup', () => {
    it('should decline a pending meetup', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup());
      mockMeetupModel.update.mockResolvedValue(mockMeetup({ status: 'DECLINED' }));

      const result = await service.declineMeetup('meetup-1', 'captain-2');

      expect(result.status).toBe('DECLINED');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'captain-1',
        'MEETUP_DECLINED',
        'Meetup Declined',
        expect.any(String)
      );
    });

    it('should throw when not receiving team captain', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup());

      await expect(service.declineMeetup('meetup-1', 'captain-1')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // ─── cancelMeetup ────────────────────────────────────

  describe('cancelMeetup', () => {
    it('should cancel a pending meetup', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup());
      mockMeetupModel.update.mockResolvedValue(mockMeetup({ status: 'CANCELLED' }));

      const result = await service.cancelMeetup('meetup-1', 'captain-1');

      expect(result.status).toBe('CANCELLED');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'captain-2',
        'MEETUP_CANCELLED',
        'Meetup Cancelled',
        expect.any(String)
      );
    });

    it('should cancel an accepted meetup', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup({ status: 'ACCEPTED' }));
      mockMeetupModel.update.mockResolvedValue(mockMeetup({ status: 'CANCELLED' }));

      const result = await service.cancelMeetup('meetup-1', 'captain-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw when not proposing team captain', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup());

      await expect(service.cancelMeetup('meetup-1', 'captain-2')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw when meetup is already declined', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup({ status: 'DECLINED' }));

      await expect(service.cancelMeetup('meetup-1', 'captain-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ─── getTeamMeetups ──────────────────────────────────

  describe('getTeamMeetups', () => {
    const PAGINATION = { page: 1, per_page: 20 };

    it('should return meetups for a team member', async () => {
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        users: [{ id: 'captain-1' }],
      });
      mockMeetupModel.count.mockResolvedValue(1);
      mockMeetupModel.findMany.mockResolvedValue([mockMeetup()]);

      const result = await service.getTeamMeetups('team-1', 'captain-1', PAGINATION);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Saturday Scrimmage');
      expect(result.meta.total).toBe(1);
    });

    it('should throw when user is not a team member', async () => {
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        users: [{ id: 'captain-1' }],
      });

      await expect(service.getTeamMeetups('team-1', 'outsider', PAGINATION)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('applies status filter when provided', async () => {
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        users: [{ id: 'captain-1' }],
      });
      mockMeetupModel.count.mockResolvedValue(0);
      mockMeetupModel.findMany.mockResolvedValue([]);

      await service.getTeamMeetups('team-1', 'captain-1', PAGINATION, 'ACCEPTED');

      expect(mockMeetupModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACCEPTED' }),
        })
      );
    });
  });

  // ─── getMeetup ──��────────────────────────────────────

  describe('getMeetup', () => {
    it('should return meetup for team member', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup());
      mockTeamModel.findFirst.mockResolvedValue({ id: 'team-1' });

      const result = await service.getMeetup('meetup-1', 'captain-1');

      expect(result.id).toBe('meetup-1');
    });

    it('should throw when user is not in either team', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(mockMeetup());
      mockTeamModel.findFirst.mockResolvedValue(null);

      await expect(service.getMeetup('meetup-1', 'outsider')).rejects.toThrow(ForbiddenException);
    });

    it('should throw when meetup not found', async () => {
      mockMeetupModel.findUnique.mockResolvedValue(null);

      await expect(service.getMeetup('missing', 'captain-1')).rejects.toThrow(NotFoundException);
    });
  });
});
