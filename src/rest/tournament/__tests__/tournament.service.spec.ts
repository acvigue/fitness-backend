import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockTournament = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
};

const mockOrganizationMember = {
  findUnique: vi.fn(),
};

const mockTeamModel = {
  findUnique: vi.fn(),
};

const mockTournamentInvitation = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const mockTournamentMatch = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
};

const mockTournamentRecap = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
};

const mockVideoModel = {
  findUnique: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    tournament: mockTournament,
    organizationMember: mockOrganizationMember,
    team: mockTeamModel,
    tournamentInvitation: mockTournamentInvitation,
    tournamentMatch: mockTournamentMatch,
    tournamentRecap: mockTournamentRecap,
    video: mockVideoModel,
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        tournament: mockTournament,
        organizationMember: mockOrganizationMember,
        team: mockTeamModel,
        tournamentInvitation: mockTournamentInvitation,
        tournamentMatch: mockTournamentMatch,
      })
    ),
  },
  redis: {},
  redisSub: {},
}));

const { TournamentService } = await import('../tournament.service');
const { NotificationService } = await import('../../notification/notification.service');
const { AchievementService } = await import('../../achievement/achievement.service');

const mockNotificationService = {
  create: vi.fn().mockResolvedValue({}),
};

const mockAchievementService = {
  incrementProgress: vi.fn().mockResolvedValue(undefined),
};

const NOW = new Date('2026-01-01T00:00:00Z');
const FUTURE = new Date('2026-06-01T09:00:00Z');

function mockTournamentData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tournament-1',
    name: 'Spring Championship',
    format: 'SINGLE_ELIMINATION',
    status: 'OPEN',
    maxTeams: 16,
    organizationId: 'org-1',
    createdById: 'user-1',
    sportId: 'sport-1',
    startDate: FUTURE,
    createdAt: NOW,
    sport: { id: 'sport-1', name: 'Basketball', icon: null },
    users: [{ id: 'user-2', username: 'jane', name: 'Jane Doe', email: 'jane@test.com' }],
    teams: [] as { id: string; name: string; captainId: string }[],
    ...overrides,
  };
}

function mockMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    userId: 'user-1',
    organizationId: 'org-1',
    role: 'ADMIN' as const,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('TournamentService', () => {
  let service: InstanceType<typeof TournamentService>;

  beforeAll(async () => {
    const { ModerationService } = await import('@/rest/moderation/moderation.service');
    const module = await Test.createTestingModule({
      providers: [
        TournamentService,
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: AchievementService, useValue: mockAchievementService },
        {
          provide: ModerationService,
          useValue: { assertAllowed: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(TournamentService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── create ──────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      name: 'Spring Championship',
      sportId: 'sport-1',
      organizationId: 'org-1',
      maxTeams: 16,
      startDate: '2026-06-01T09:00:00Z',
    };

    it('should create a tournament when user is org ADMIN', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournament.create.mockResolvedValue(mockTournamentData());

      const result = await service.create(createDto, 'user-1');

      expect(result.id).toBe('tournament-1');
      expect(result.name).toBe('Spring Championship');
      expect(result.maxTeams).toBe(16);
      expect(result.organizationId).toBe('org-1');
      expect(result.sport.name).toBe('Basketball');
      expect(result.participants).toHaveLength(1);
      expect(mockTournament.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Spring Championship',
            maxTeams: 16,
            createdById: 'user-1',
          }),
        })
      );
    });

    it('should create a tournament when user is org STAFF', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'STAFF' }));
      mockTournament.create.mockResolvedValue(mockTournamentData());

      const result = await service.create(createDto, 'user-1');

      expect(result.id).toBe('tournament-1');
    });

    it('should throw BadRequestException when maxTeams is not a power of 2', async () => {
      await expect(service.create({ ...createDto, maxTeams: 3 }, 'user-1')).rejects.toThrow(
        BadRequestException
      );

      await expect(service.create({ ...createDto, maxTeams: 5 }, 'user-1')).rejects.toThrow(
        BadRequestException
      );

      await expect(service.create({ ...createDto, maxTeams: 6 }, 'user-1')).rejects.toThrow(
        BadRequestException
      );

      await expect(service.create({ ...createDto, maxTeams: 10 }, 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should accept valid powers of 2 for maxTeams', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));

      for (const maxTeams of [2, 4, 8, 16, 32, 64]) {
        mockTournament.create.mockResolvedValue(mockTournamentData({ maxTeams }));
        const result = await service.create({ ...createDto, maxTeams }, 'user-1');
        expect(result.maxTeams).toBe(maxTeams);
      }
    });

    it('should throw ForbiddenException when user is MEMBER role', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }));

      await expect(service.create(createDto, 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is not in the organization', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── findAll ─────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated tournaments', async () => {
      const tournaments = [mockTournamentData(), mockTournamentData({ id: 'tournament-2' })];
      mockTournament.count.mockResolvedValue(2);
      mockTournament.findMany.mockResolvedValue(tournaments);

      const result = await service.findAll({ page: 1, per_page: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, per_page: 10, total: 2, total_pages: 1 });
    });

    it('should pass correct skip/take for pagination', async () => {
      mockTournament.count.mockResolvedValue(25);
      mockTournament.findMany.mockResolvedValue([]);

      await service.findAll({ page: 3, per_page: 5 });

      expect(mockTournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 })
      );
    });

    it('should filter by sportId', async () => {
      mockTournament.count.mockResolvedValue(0);
      mockTournament.findMany.mockResolvedValue([]);

      await service.findAll({ page: 1, per_page: 10 }, { sportId: 'sport-1' });

      expect(mockTournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sportId: 'sport-1' } })
      );
    });

    it('should filter by status', async () => {
      mockTournament.count.mockResolvedValue(0);
      mockTournament.findMany.mockResolvedValue([]);

      await service.findAll({ page: 1, per_page: 10 }, { status: 'OPEN' });

      expect(mockTournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'OPEN' } })
      );
    });

    it('should filter by date range', async () => {
      mockTournament.count.mockResolvedValue(0);
      mockTournament.findMany.mockResolvedValue([]);

      await service.findAll(
        { page: 1, per_page: 10 },
        { startAfter: '2026-01-01T00:00:00Z', startBefore: '2026-12-31T00:00:00Z' }
      );

      expect(mockTournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            startDate: {
              gte: new Date('2026-01-01T00:00:00Z'),
              lte: new Date('2026-12-31T00:00:00Z'),
            },
          },
        })
      );
    });

    it('should combine multiple filters', async () => {
      mockTournament.count.mockResolvedValue(0);
      mockTournament.findMany.mockResolvedValue([]);

      await service.findAll({ page: 1, per_page: 10 }, { sportId: 'sport-1', status: 'OPEN' });

      expect(mockTournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sportId: 'sport-1', status: 'OPEN' },
        })
      );
    });
  });

  // ─── search ──────────────────────────────────────────

  describe('search', () => {
    it('should search tournaments by name', async () => {
      const tournaments = [mockTournamentData()];
      mockTournament.count.mockResolvedValue(1);
      mockTournament.findMany.mockResolvedValue(tournaments);

      const result = await service.search('Spring', { page: 1, per_page: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Spring Championship');
      expect(mockTournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: 'Spring', mode: 'insensitive' } },
        })
      );
    });

    it('should return empty results for no matches', async () => {
      mockTournament.count.mockResolvedValue(0);
      mockTournament.findMany.mockResolvedValue([]);

      const result = await service.search('Nonexistent', { page: 1, per_page: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─── findOne ─────────────────────────────────────────

  describe('findOne', () => {
    it('should return a single tournament', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());

      const result = await service.findOne('tournament-1');

      expect(result.id).toBe('tournament-1');
      expect(result.name).toBe('Spring Championship');
      expect(result.sport.name).toBe('Basketball');
    });

    it('should throw NotFoundException when tournament does not exist', async () => {
      mockTournament.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ──────────────────────────────────────────

  describe('update', () => {
    it('should update tournament when user is ADMIN', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournament.update.mockResolvedValue(mockTournamentData({ name: 'Updated' }));

      const result = await service.update('tournament-1', { name: 'Updated' }, 'user-1');

      expect(result.name).toBe('Updated');
    });

    it('should update tournament when user is STAFF', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'STAFF' }));
      mockTournament.update.mockResolvedValue(mockTournamentData({ name: 'Updated' }));

      const result = await service.update('tournament-1', { name: 'Updated' }, 'user-1');

      expect(result.name).toBe('Updated');
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }));

      await expect(service.update('tournament-1', { name: 'Updated' }, 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(null);

      await expect(service.update('tournament-1', { name: 'Updated' }, 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw NotFoundException when tournament does not exist', async () => {
      mockTournament.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' }, 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when updating maxTeams to non-power of 2', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));

      await expect(service.update('tournament-1', { maxTeams: 7 }, 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should allow updating maxTeams to a valid power of 2', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournament.update.mockResolvedValue(mockTournamentData({ maxTeams: 32 }));

      const result = await service.update('tournament-1', { maxTeams: 32 }, 'user-1');

      expect(result.maxTeams).toBe(32);
    });

    it('should pass conditional data for partial updates', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournament.update.mockResolvedValue(mockTournamentData());

      await service.update('tournament-1', { name: 'New Name' }, 'user-1');

      expect(mockTournament.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'New Name' } })
      );
    });
  });

  // ─── delete ──────────────────────────────────────────

  describe('delete', () => {
    it('should delete tournament when user is ADMIN', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournament.delete.mockResolvedValue(mockTournamentData());

      await service.delete('tournament-1', 'user-1');

      expect(mockTournament.delete).toHaveBeenCalledWith({ where: { id: 'tournament-1' } });
    });

    it('should delete tournament when user is STAFF', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'STAFF' }));
      mockTournament.delete.mockResolvedValue(mockTournamentData());

      await service.delete('tournament-1', 'user-1');

      expect(mockTournament.delete).toHaveBeenCalledWith({ where: { id: 'tournament-1' } });
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }));

      await expect(service.delete('tournament-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(null);

      await expect(service.delete('tournament-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when tournament does not exist', async () => {
      mockTournament.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── joinTournament ─────────────────────────────────────

  describe('joinTournament', () => {
    it('should register a team when captain and tournament is open', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ teams: [] }));
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'user-1',
        sportId: 'sport-1',
        users: [],
      });
      mockTournament.update.mockResolvedValue(
        mockTournamentData({ teams: [{ id: 'team-1', name: 'Alpha', captainId: 'user-1' }] })
      );

      const result = await service.joinTournament('tournament-1', 'team-1', 'user-1');

      expect(result.teams).toHaveLength(1);
      expect(mockTournament.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { teams: { connect: { id: 'team-1' } } },
        })
      );
    });

    it('should throw BadRequestException when tournament is not OPEN', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ status: 'CLOSED', teams: [] })
      );

      await expect(service.joinTournament('tournament-1', 'team-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ teams: [] }));
      mockTeamModel.findUnique.mockResolvedValue({ id: 'team-1', captainId: 'other-user' });

      await expect(service.joinTournament('tournament-1', 'team-1', 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw BadRequestException when team is already registered', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ teams: [{ id: 'team-1' }] })
      );
      mockTeamModel.findUnique.mockResolvedValue({ id: 'team-1', captainId: 'user-1' });

      await expect(service.joinTournament('tournament-1', 'team-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when tournament is at capacity', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ maxTeams: 2, teams: [{ id: 'team-a' }, { id: 'team-b' }] })
      );
      mockTeamModel.findUnique.mockResolvedValue({ id: 'team-1', captainId: 'user-1' });

      await expect(service.joinTournament('tournament-1', 'team-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ─── leaveTournament ────────────────────────────────────

  describe('leaveTournament', () => {
    it('should withdraw a team when captain', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ teams: [{ id: 'team-1' }] })
      );
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'user-1',
        sportId: 'sport-1',
        users: [],
      });
      mockTournament.update.mockResolvedValue(mockTournamentData());

      await service.leaveTournament('tournament-1', 'team-1', 'user-1');

      expect(mockTournament.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { teams: { disconnect: { id: 'team-1' } } },
        })
      );
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ teams: [{ id: 'team-1' }] })
      );
      mockTeamModel.findUnique.mockResolvedValue({ id: 'team-1', captainId: 'other-user' });

      await expect(service.leaveTournament('tournament-1', 'team-1', 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw BadRequestException when team is not registered', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ teams: [] }));
      mockTeamModel.findUnique.mockResolvedValue({ id: 'team-1', captainId: 'user-1' });

      await expect(service.leaveTournament('tournament-1', 'team-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ─── addTeam (org manager) ──────────────────────────────

  describe('addTeam', () => {
    it('should add a team when user is org manager', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ teams: [] }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'user-1',
        sportId: 'sport-1',
        users: [],
      });
      mockTournament.update.mockResolvedValue(
        mockTournamentData({ teams: [{ id: 'team-1', name: 'Alpha', captainId: 'cap-1' }] })
      );

      const result = await service.addTeam('tournament-1', 'team-1', 'user-1');

      expect(result.teams).toHaveLength(1);
    });

    it('should throw BadRequestException when at capacity', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ maxTeams: 2, teams: [{ id: 'a' }, { id: 'b' }] })
      );
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));

      await expect(service.addTeam('tournament-1', 'team-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw ForbiddenException when user is MEMBER role', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ teams: [] }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }));

      await expect(service.addTeam('tournament-1', 'team-1', 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // ─── removeTeam (org manager) ───────────────────────────

  describe('removeTeam', () => {
    it('should remove a team when user is org manager', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ teams: [{ id: 'team-1' }] })
      );
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'user-1',
        sportId: 'sport-1',
        users: [],
      });
      mockTournament.update.mockResolvedValue(mockTournamentData());

      await service.removeTeam('tournament-1', 'team-1', 'user-1');

      expect(mockTournament.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { teams: { disconnect: { id: 'team-1' } } },
        })
      );
    });

    it('should throw BadRequestException when team is not registered', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ teams: [] }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));

      await expect(service.removeTeam('tournament-1', 'team-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ─── sendTournamentInvitation ───────────────────────────

  describe('sendTournamentInvitation', () => {
    it('should send an invitation when user is org manager', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournamentInvitation.findFirst.mockResolvedValue(null);
      mockTournamentInvitation.create.mockResolvedValue({
        id: 'tinv-1',
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        status: 'PENDING',
        createdAt: NOW,
      });
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        name: 'Alpha',
        captainId: 'cap-1',
        sportId: 'sport-1',
      });

      const result = await service.sendTournamentInvitation('tournament-1', 'team-1', 'user-1');

      expect(result.status).toBe('PENDING');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'cap-1',
        'TOURNAMENT_INVITE',
        'Tournament Invitation',
        expect.stringContaining('Spring Championship')
      );
    });

    it('should throw BadRequestException when invitation already pending', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournamentInvitation.findFirst.mockResolvedValue({ id: 'tinv-1' });

      await expect(
        service.sendTournamentInvitation('tournament-1', 'team-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }));

      await expect(
        service.sendTournamentInvitation('tournament-1', 'team-1', 'user-1')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── respondToTournamentInvitation ──────────────────────

  describe('respondToTournamentInvitation', () => {
    it('should accept invitation and add team to tournament', async () => {
      mockTournamentInvitation.findUnique.mockResolvedValue({
        id: 'tinv-1',
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        status: 'PENDING',
        createdAt: NOW,
        team: { id: 'team-1', captainId: 'cap-1' },
        tournament: { id: 'tournament-1', name: 'Spring Championship' },
      });
      mockTournamentInvitation.update.mockResolvedValue({
        id: 'tinv-1',
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        status: 'ACCEPTED',
        createdAt: NOW,
      });
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ teams: [] }));
      mockTournament.update.mockResolvedValue(mockTournamentData());

      const result = await service.respondToTournamentInvitation('tinv-1', 'cap-1', true);

      expect(result.status).toBe('ACCEPTED');
      expect(mockTournament.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { teams: { connect: { id: 'team-1' } } },
        })
      );
    });

    it('should decline invitation without adding team', async () => {
      mockTournamentInvitation.findUnique.mockResolvedValue({
        id: 'tinv-1',
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        status: 'PENDING',
        createdAt: NOW,
        team: { id: 'team-1', captainId: 'cap-1' },
        tournament: { id: 'tournament-1', name: 'Spring Championship' },
      });
      mockTournamentInvitation.update.mockResolvedValue({
        id: 'tinv-1',
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        status: 'DECLINED',
        createdAt: NOW,
      });

      const result = await service.respondToTournamentInvitation('tinv-1', 'cap-1', false);

      expect(result.status).toBe('DECLINED');
      expect(mockTournament.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTournamentInvitation.findUnique.mockResolvedValue({
        id: 'tinv-1',
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        status: 'PENDING',
        createdAt: NOW,
        team: { id: 'team-1', captainId: 'cap-1' },
        tournament: { id: 'tournament-1', name: 'Spring Championship' },
      });

      await expect(
        service.respondToTournamentInvitation('tinv-1', 'wrong-user', true)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when already responded', async () => {
      mockTournamentInvitation.findUnique.mockResolvedValue({
        id: 'tinv-1',
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        status: 'ACCEPTED',
        createdAt: NOW,
        team: { id: 'team-1', captainId: 'cap-1' },
        tournament: { id: 'tournament-1', name: 'Spring Championship' },
      });

      await expect(service.respondToTournamentInvitation('tinv-1', 'cap-1', true)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ─── getTournamentInvitations ───────────────────────────

  describe('getTournamentInvitations', () => {
    it('should return invitations when user is org manager', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournamentInvitation.findMany.mockResolvedValue([
        {
          id: 'tinv-1',
          tournamentId: 'tournament-1',
          teamId: 'team-1',
          status: 'PENDING',
          createdAt: NOW,
        },
      ]);

      const result = await service.getTournamentInvitations('tournament-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
    });
  });

  // ─── generateBracket ──────────────────────────────────

  describe('generateBracket', () => {
    const fourTeams = [
      { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
      { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
      { id: 'team-3', name: 'Charlie', captainId: 'cap-3' },
      { id: 'team-4', name: 'Delta', captainId: 'cap-4' },
    ];

    it('should generate bracket for 4 teams with correct structure', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ maxTeams: 4, teams: fourTeams, matches: [] })
      );
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));

      // Round 2 (final) created first, then round 1
      let createCallCount = 0;
      mockTournamentMatch.create.mockImplementation(() => {
        createCallCount++;
        return Promise.resolve({
          id: `match-${createCallCount}`,
          tournamentId: 'tournament-1',
          round: createCallCount === 1 ? 2 : createCallCount === 2 ? 1 : 1,
          matchNumber: createCallCount <= 1 ? 1 : createCallCount - 1,
        });
      });

      mockTournamentMatch.update.mockResolvedValue({});
      mockTournament.update.mockResolvedValue(mockTournamentData({ status: 'INPROGRESS' }));

      // For getBracket call at end
      mockTournamentMatch.findMany.mockResolvedValue([
        {
          id: 'match-2',
          round: 1,
          matchNumber: 1,
          status: 'PENDING',
          nextMatchId: 'match-1',
          team1: fourTeams[0],
          team2: fourTeams[1],
          team1Score: null,
          team2Score: null,
          winner: null,
        },
        {
          id: 'match-3',
          round: 1,
          matchNumber: 2,
          status: 'PENDING',
          nextMatchId: 'match-1',
          team1: fourTeams[2],
          team2: fourTeams[3],
          team1Score: null,
          team2Score: null,
          winner: null,
        },
        {
          id: 'match-1',
          round: 2,
          matchNumber: 1,
          status: 'PENDING',
          nextMatchId: null,
          team1: null,
          team2: null,
          team1Score: null,
          team2Score: null,
          winner: null,
        },
      ]);

      const result = await service.generateBracket('tournament-1', 'user-1');

      expect(result.totalRounds).toBe(2);
      expect(result.rounds).toHaveLength(2);
      expect(result.rounds[0].round).toBe(1);
      expect(result.rounds[0].label).toBe('Semifinals');
      expect(result.rounds[0].matches).toHaveLength(2);
      expect(result.rounds[1].round).toBe(2);
      expect(result.rounds[1].label).toBe('Final');
      expect(result.rounds[1].matches).toHaveLength(1);

      // Should have set tournament status to INPROGRESS
      expect(mockTournament.update).toHaveBeenCalledWith({
        where: { id: 'tournament-1' },
        data: { status: 'INPROGRESS' },
      });
    });

    it('should throw BadRequestException when bracket already generated', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ teams: fourTeams, matches: [{ id: 'match-1' }] })
      );
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));

      await expect(service.generateBracket('tournament-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when fewer than 2 teams', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ teams: [fourTeams[0]], matches: [] })
      );
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));

      await expect(service.generateBracket('tournament-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw ForbiddenException when user is MEMBER role', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ teams: fourTeams, matches: [] })
      );
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }));

      await expect(service.generateBracket('tournament-1', 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw NotFoundException when tournament does not exist', async () => {
      mockTournament.findUnique.mockResolvedValue(null);

      await expect(service.generateBracket('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── getBracket ────────────────────────────────────────

  describe('getBracket', () => {
    it('should return bracket organized by rounds', async () => {
      mockTournament.findUnique.mockResolvedValue({ id: 'tournament-1' });
      mockTournamentMatch.findMany.mockResolvedValue([
        {
          id: 'match-1',
          round: 1,
          matchNumber: 1,
          status: 'COMPLETED',
          nextMatchId: 'match-3',
          team1: { id: 't1', name: 'A', captainId: 'c1' },
          team2: { id: 't2', name: 'B', captainId: 'c2' },
          team1Score: 3,
          team2Score: 1,
          winner: { id: 't1', name: 'A', captainId: 'c1' },
        },
        {
          id: 'match-2',
          round: 1,
          matchNumber: 2,
          status: 'PENDING',
          nextMatchId: 'match-3',
          team1: { id: 't3', name: 'C', captainId: 'c3' },
          team2: { id: 't4', name: 'D', captainId: 'c4' },
          team1Score: null,
          team2Score: null,
          winner: null,
        },
        {
          id: 'match-3',
          round: 2,
          matchNumber: 1,
          status: 'PENDING',
          nextMatchId: null,
          team1: { id: 't1', name: 'A', captainId: 'c1' },
          team2: null,
          team1Score: null,
          team2Score: null,
          winner: null,
        },
      ]);

      const result = await service.getBracket('tournament-1');

      expect(result.tournamentId).toBe('tournament-1');
      expect(result.totalRounds).toBe(2);
      expect(result.rounds[0].matches).toHaveLength(2);
      expect(result.rounds[0].matches[0].team1Score).toBe(3);
      expect(result.rounds[1].matches).toHaveLength(1);
    });

    it('should throw BadRequestException when bracket not generated yet', async () => {
      mockTournament.findUnique.mockResolvedValue({ id: 'tournament-1' });
      mockTournamentMatch.findMany.mockResolvedValue([]);

      await expect(service.getBracket('tournament-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when tournament does not exist', async () => {
      mockTournament.findUnique.mockResolvedValue(null);

      await expect(service.getBracket('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── recordMatchResult ─────────────────────────────────

  describe('recordMatchResult', () => {
    it('should record result and advance winner to next match', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ status: 'INPROGRESS' }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournamentMatch.findUnique
        .mockResolvedValueOnce({
          id: 'match-1',
          tournamentId: 'tournament-1',
          round: 1,
          matchNumber: 1,
          team1Id: 'team-1',
          team2Id: 'team-2',
          team1: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
          team2: { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
          winner: null,
          team1Score: null,
          team2Score: null,
          status: 'PENDING',
          nextMatchId: 'match-3',
          nextMatch: { id: 'match-3' },
        })
        // placeWinnerInNextMatch lookup
        .mockResolvedValueOnce({
          id: 'match-3',
          team1Id: null,
          team2Id: null,
        });

      mockTournamentMatch.update
        .mockResolvedValueOnce({
          id: 'match-1',
          round: 1,
          matchNumber: 1,
          team1: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
          team2: { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
          team1Score: 5,
          team2Score: 2,
          winner: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
          status: 'COMPLETED',
          nextMatchId: 'match-3',
        })
        // placeWinnerInNextMatch update
        .mockResolvedValueOnce({});

      // For awardMatchAchievements
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'cap-1',
        users: [{ id: 'member-1' }, { id: 'member-2' }],
      });

      const result = await service.recordMatchResult(
        'tournament-1',
        'match-1',
        { team1Score: 5, team2Score: 2 },
        'user-1'
      );

      expect(result.team1Score).toBe(5);
      expect(result.team2Score).toBe(2);
      expect(result.winner?.id).toBe('team-1');
      expect(result.status).toBe('COMPLETED');

      // Winner placed in next match
      expect(mockTournamentMatch.update).toHaveBeenCalledWith({
        where: { id: 'match-3' },
        data: { team1Id: 'team-1' },
      });
    });

    it('should mark tournament COMPLETED when final match is decided', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ status: 'INPROGRESS' }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournamentMatch.findUnique.mockResolvedValueOnce({
        id: 'final-match',
        tournamentId: 'tournament-1',
        round: 2,
        matchNumber: 1,
        team1Id: 'team-1',
        team2Id: 'team-2',
        team1: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
        team2: { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
        winner: null,
        team1Score: null,
        team2Score: null,
        status: 'PENDING',
        nextMatchId: null,
        nextMatch: null,
      });
      mockTournamentMatch.update.mockResolvedValueOnce({
        id: 'final-match',
        round: 2,
        matchNumber: 1,
        team1: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
        team2: { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
        team1Score: 1,
        team2Score: 4,
        winner: { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
        status: 'COMPLETED',
        nextMatchId: null,
      });
      mockTournament.update.mockResolvedValue({});
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-2',
        captainId: 'cap-2',
        users: [],
      });

      const result = await service.recordMatchResult(
        'tournament-1',
        'final-match',
        { team1Score: 1, team2Score: 4 },
        'user-1'
      );

      expect(result.winner?.id).toBe('team-2');

      // Tournament marked COMPLETED
      expect(mockTournament.update).toHaveBeenCalledWith({
        where: { id: 'tournament-1' },
        data: { status: 'COMPLETED' },
      });
    });

    it('should award TOURNAMENT_MATCH_WIN achievement to winning team members', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ status: 'INPROGRESS' }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournamentMatch.findUnique.mockResolvedValueOnce({
        id: 'match-1',
        tournamentId: 'tournament-1',
        round: 1,
        matchNumber: 1,
        team1Id: 'team-1',
        team2Id: 'team-2',
        team1: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
        team2: { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
        winner: null,
        status: 'PENDING',
        nextMatchId: 'match-3',
        nextMatch: { id: 'match-3' },
      });
      mockTournamentMatch.findUnique.mockResolvedValueOnce({
        id: 'match-3',
        team1Id: null,
        team2Id: null,
      });
      mockTournamentMatch.update
        .mockResolvedValueOnce({
          id: 'match-1',
          round: 1,
          matchNumber: 1,
          team1: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
          team2: { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
          team1Score: 10,
          team2Score: 5,
          winner: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
          status: 'COMPLETED',
          nextMatchId: 'match-3',
        })
        .mockResolvedValueOnce({});
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'cap-1',
        users: [{ id: 'member-1' }],
      });

      await service.recordMatchResult(
        'tournament-1',
        'match-1',
        { team1Score: 10, team2Score: 5 },
        'user-1'
      );

      // Give fire-and-forget a tick
      await new Promise((r) => setTimeout(r, 10));

      expect(mockAchievementService.incrementProgress).toHaveBeenCalledWith(
        'cap-1',
        'TOURNAMENT_MATCH_WIN'
      );
      expect(mockAchievementService.incrementProgress).toHaveBeenCalledWith(
        'member-1',
        'TOURNAMENT_MATCH_WIN'
      );
    });

    it('should award TOURNAMENT_WIN achievement when final match won', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ status: 'INPROGRESS' }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournamentMatch.findUnique.mockResolvedValueOnce({
        id: 'final',
        tournamentId: 'tournament-1',
        round: 2,
        matchNumber: 1,
        team1Id: 'team-1',
        team2Id: 'team-2',
        team1: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
        team2: { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
        winner: null,
        status: 'PENDING',
        nextMatchId: null,
        nextMatch: null,
      });
      mockTournamentMatch.update.mockResolvedValueOnce({
        id: 'final',
        round: 2,
        matchNumber: 1,
        team1: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
        team2: { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
        team1Score: 7,
        team2Score: 3,
        winner: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
        status: 'COMPLETED',
        nextMatchId: null,
      });
      mockTournament.update.mockResolvedValue({});
      mockTeamModel.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'cap-1',
        users: [{ id: 'member-1' }],
      });

      await service.recordMatchResult(
        'tournament-1',
        'final',
        { team1Score: 7, team2Score: 3 },
        'user-1'
      );

      await new Promise((r) => setTimeout(r, 10));

      expect(mockAchievementService.incrementProgress).toHaveBeenCalledWith(
        'cap-1',
        'TOURNAMENT_WIN'
      );
      expect(mockAchievementService.incrementProgress).toHaveBeenCalledWith(
        'member-1',
        'TOURNAMENT_WIN'
      );
    });

    it('should throw BadRequestException for tied scores', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ status: 'INPROGRESS' }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournamentMatch.findUnique.mockResolvedValueOnce({
        id: 'match-1',
        tournamentId: 'tournament-1',
        team1Id: 'team-1',
        team2Id: 'team-2',
        team1: { id: 'team-1', name: 'Alpha', captainId: 'cap-1' },
        team2: { id: 'team-2', name: 'Bravo', captainId: 'cap-2' },
        status: 'PENDING',
        nextMatchId: null,
        nextMatch: null,
      });

      await expect(
        service.recordMatchResult(
          'tournament-1',
          'match-1',
          { team1Score: 3, team2Score: 3 },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when match is already completed', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ status: 'INPROGRESS' }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournamentMatch.findUnique.mockResolvedValueOnce({
        id: 'match-1',
        tournamentId: 'tournament-1',
        team1Id: 'team-1',
        team2Id: 'team-2',
        status: 'COMPLETED',
        nextMatchId: null,
        nextMatch: null,
      });

      await expect(
        service.recordMatchResult(
          'tournament-1',
          'match-1',
          { team1Score: 3, team2Score: 1 },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when tournament is not INPROGRESS', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ status: 'OPEN' }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));

      await expect(
        service.recordMatchResult(
          'tournament-1',
          'match-1',
          { team1Score: 3, team2Score: 1 },
          'user-1'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when match does not belong to tournament', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ status: 'INPROGRESS' }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockTournamentMatch.findUnique.mockResolvedValueOnce({
        id: 'match-1',
        tournamentId: 'other-tournament',
        status: 'PENDING',
      });

      await expect(
        service.recordMatchResult(
          'tournament-1',
          'match-1',
          { team1Score: 3, team2Score: 1 },
          'user-1'
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is MEMBER role', async () => {
      mockTournament.findUnique.mockResolvedValue(mockTournamentData({ status: 'INPROGRESS' }));
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }));

      await expect(
        service.recordMatchResult(
          'tournament-1',
          'match-1',
          { team1Score: 3, team2Score: 1 },
          'user-1'
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('seedBracketFromStandings', () => {
    it('rejects non-round-robin format', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({
          format: 'SINGLE_ELIMINATION',
          matches: [{ id: 'm-1', status: 'COMPLETED', round: 1 }],
          teams: [],
        })
      );
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      await expect(service.seedBracketFromStandings('tournament-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects when round robin has no matches', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({ format: 'ROUND_ROBIN', matches: [], teams: [] })
      );
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      await expect(service.seedBracketFromStandings('tournament-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects when pending matches remain', async () => {
      mockTournament.findUnique.mockResolvedValue(
        mockTournamentData({
          format: 'ROUND_ROBIN',
          matches: [
            { id: 'm-1', status: 'COMPLETED', round: 1 },
            { id: 'm-2', status: 'PENDING', round: 1 },
          ],
          teams: [],
        })
      );
      mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
      await expect(service.seedBracketFromStandings('tournament-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('recaps', () => {
    const completedTournament = mockTournamentData({ status: 'COMPLETED' });
    const recapRecord = {
      id: 'recap-1',
      tournamentId: 'tournament-1',
      videoId: 'v-1',
      uploadedById: 'user-1',
      createdAt: NOW,
      video: {
        id: 'v-1',
        name: 'Finals Recap',
        description: 'highlights',
        uploaderId: 'user-1',
        sportId: 'sport-1',
        url: 'https://cdn.example/v-1',
      },
    };

    describe('listRecaps', () => {
      it('returns recaps for a tournament', async () => {
        mockTournament.findUnique.mockResolvedValue(completedTournament);
        mockTournamentRecap.findMany.mockResolvedValue([recapRecord]);

        const result = await service.listRecaps('tournament-1');
        expect(result).toHaveLength(1);
        expect(result[0].video.name).toBe('Finals Recap');
      });

      it('throws NotFoundException for missing tournament', async () => {
        mockTournament.findUnique.mockResolvedValue(null);
        await expect(service.listRecaps('nope')).rejects.toThrow(NotFoundException);
      });
    });

    describe('addRecap', () => {
      it('rejects when tournament is not completed', async () => {
        mockTournament.findUnique.mockResolvedValue(mockTournamentData({ status: 'OPEN' }));
        await expect(service.addRecap('tournament-1', 'v-1', 'user-1')).rejects.toThrow(
          BadRequestException
        );
      });

      it('rejects non-org-manager', async () => {
        mockTournament.findUnique.mockResolvedValue(completedTournament);
        mockOrganizationMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

        await expect(service.addRecap('tournament-1', 'v-1', 'user-1')).rejects.toThrow(
          ForbiddenException
        );
      });

      it('rejects duplicate recap link', async () => {
        mockTournament.findUnique.mockResolvedValue(completedTournament);
        mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
        mockVideoModel.findUnique.mockResolvedValue(recapRecord.video);
        mockTournamentRecap.findUnique.mockResolvedValue(recapRecord);

        await expect(service.addRecap('tournament-1', 'v-1', 'user-1')).rejects.toThrow(
          BadRequestException
        );
      });

      it('creates recap when all checks pass', async () => {
        mockTournament.findUnique.mockResolvedValue(completedTournament);
        mockOrganizationMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
        mockVideoModel.findUnique.mockResolvedValue(recapRecord.video);
        mockTournamentRecap.findUnique.mockResolvedValue(null);
        mockTournamentRecap.create.mockResolvedValue(recapRecord);

        const result = await service.addRecap('tournament-1', 'v-1', 'user-1');
        expect(result.id).toBe('recap-1');
        expect(mockTournamentRecap.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              tournamentId: 'tournament-1',
              videoId: 'v-1',
              uploadedById: 'user-1',
            },
          })
        );
      });

      it('throws NotFoundException for missing video', async () => {
        mockTournament.findUnique.mockResolvedValue(completedTournament);
        mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });
        mockVideoModel.findUnique.mockResolvedValue(null);

        await expect(service.addRecap('tournament-1', 'v-1', 'user-1')).rejects.toThrow(
          NotFoundException
        );
      });
    });

    describe('removeRecap', () => {
      it('deletes recap when user is org manager', async () => {
        mockTournamentRecap.findUnique.mockResolvedValue({
          ...recapRecord,
          tournament: completedTournament,
        });
        mockOrganizationMember.findUnique.mockResolvedValue({ role: 'STAFF' });

        await service.removeRecap('tournament-1', 'recap-1', 'user-1');
        expect(mockTournamentRecap.delete).toHaveBeenCalledWith({ where: { id: 'recap-1' } });
      });

      it('rejects when recap not found', async () => {
        mockTournamentRecap.findUnique.mockResolvedValue(null);
        await expect(service.removeRecap('tournament-1', 'r-x', 'user-1')).rejects.toThrow(
          NotFoundException
        );
      });

      it('rejects when recap belongs to other tournament', async () => {
        mockTournamentRecap.findUnique.mockResolvedValue({
          ...recapRecord,
          tournamentId: 'other',
          tournament: completedTournament,
        });
        await expect(service.removeRecap('tournament-1', 'recap-1', 'user-1')).rejects.toThrow(
          NotFoundException
        );
      });
    });
  });
});
