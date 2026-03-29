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

vi.mock('@/shared/utils', () => ({
  prisma: {
    tournament: mockTournament,
    organizationMember: mockOrganizationMember,
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        tournament: mockTournament,
        organizationMember: mockOrganizationMember,
      })
    ),
  },
  redis: {},
  redisSub: {},
}));

const { TournamentService } = await import('../tournament.service');

const NOW = new Date('2026-01-01T00:00:00Z');
const FUTURE = new Date('2026-06-01T09:00:00Z');

function mockTournamentData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tournament-1',
    name: 'Spring Championship',
    status: 'OPEN',
    maxTeams: 16,
    organizationId: 'org-1',
    createdById: 'user-1',
    sportId: 'sport-1',
    startDate: FUTURE,
    createdAt: NOW,
    sport: { id: 'sport-1', name: 'Basketball', icon: null },
    users: [{ id: 'user-2', username: 'jane', name: 'Jane Doe', email: 'jane@test.com' }],
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
    const module = await Test.createTestingModule({
      providers: [TournamentService],
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
});
