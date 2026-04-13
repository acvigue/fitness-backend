import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockTeamModel = {
  findUnique: vi.fn(),
};

const mockTeamBlockModel = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    team: mockTeamModel,
    teamBlock: mockTeamBlockModel,
  },
  redis: {},
  redisSub: {},
}));

const { TeamBlockService } = await import('../team-block.service');

const NOW = new Date('2026-01-01T00:00:00Z');

function mockTeam(overrides: Record<string, unknown> = {}) {
  return { id: 'team-1', name: 'Team Alpha', captainId: 'captain-1', ...overrides };
}

describe('TeamBlockService', () => {
  let service: InstanceType<typeof TeamBlockService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [TeamBlockService],
    }).compile();

    service = module.get(TeamBlockService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── blockTeam ────────────────────────────────────────

  describe('blockTeam', () => {
    it('should block another team', async () => {
      mockTeamModel.findUnique
        .mockResolvedValueOnce(mockTeam())
        .mockResolvedValueOnce(mockTeam({ id: 'team-2', name: 'Team Beta' }));
      mockTeamBlockModel.findUnique.mockResolvedValue(null);
      mockTeamBlockModel.create.mockResolvedValue({
        id: 'block-1',
        blockingTeamId: 'team-1',
        blockedTeamId: 'team-2',
        blockedTeam: { name: 'Team Beta' },
        createdAt: NOW,
      });

      const result = await service.blockTeam('team-1', { blockedTeamId: 'team-2' }, 'captain-1');

      expect(result.blockedTeamId).toBe('team-2');
      expect(result.blockedTeamName).toBe('Team Beta');
    });

    it('should throw ForbiddenException when not captain', async () => {
      mockTeamModel.findUnique.mockResolvedValue(mockTeam());

      await expect(
        service.blockTeam('team-1', { blockedTeamId: 'team-2' }, 'other-user')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when blocking own team', async () => {
      mockTeamModel.findUnique.mockResolvedValue(mockTeam());

      await expect(
        service.blockTeam('team-1', { blockedTeamId: 'team-1' }, 'captain-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when target team does not exist', async () => {
      mockTeamModel.findUnique.mockResolvedValueOnce(mockTeam()).mockResolvedValueOnce(null);

      await expect(
        service.blockTeam('team-1', { blockedTeamId: 'missing' }, 'captain-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when already blocked', async () => {
      mockTeamModel.findUnique
        .mockResolvedValueOnce(mockTeam())
        .mockResolvedValueOnce(mockTeam({ id: 'team-2' }));
      mockTeamBlockModel.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.blockTeam('team-1', { blockedTeamId: 'team-2' }, 'captain-1')
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── getBlockedTeams ──────────────────────────────────

  describe('getBlockedTeams', () => {
    it('should return blocked teams list', async () => {
      mockTeamModel.findUnique.mockResolvedValue(mockTeam());
      mockTeamBlockModel.findMany.mockResolvedValue([
        {
          id: 'block-1',
          blockingTeamId: 'team-1',
          blockedTeamId: 'team-2',
          blockedTeam: { name: 'Team Beta' },
          createdAt: NOW,
        },
      ]);

      const result = await service.getBlockedTeams('team-1', 'captain-1');

      expect(result).toHaveLength(1);
      expect(result[0].blockedTeamName).toBe('Team Beta');
    });

    it('should throw ForbiddenException when not captain', async () => {
      mockTeamModel.findUnique.mockResolvedValue(mockTeam());

      await expect(service.getBlockedTeams('team-1', 'other-user')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // ─── unblockTeam ──────────────────────────────────────

  describe('unblockTeam', () => {
    it('should unblock a team', async () => {
      mockTeamModel.findUnique.mockResolvedValue(mockTeam());
      mockTeamBlockModel.findUnique.mockResolvedValue({ id: 'block-1' });
      mockTeamBlockModel.delete.mockResolvedValue({});

      await service.unblockTeam('team-1', 'team-2', 'captain-1');

      expect(mockTeamBlockModel.delete).toHaveBeenCalledWith({ where: { id: 'block-1' } });
    });

    it('should throw NotFoundException when block does not exist', async () => {
      mockTeamModel.findUnique.mockResolvedValue(mockTeam());
      mockTeamBlockModel.findUnique.mockResolvedValue(null);

      await expect(service.unblockTeam('team-1', 'team-2', 'captain-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── isBlocked ────────────────────────────────────────

  describe('isBlocked', () => {
    it('should return true when a block exists', async () => {
      mockTeamBlockModel.findFirst.mockResolvedValue({ id: 'block-1' });

      const result = await service.isBlocked('team-1', 'team-2');

      expect(result).toBe(true);
    });

    it('should return false when no block exists', async () => {
      mockTeamBlockModel.findFirst.mockResolvedValue(null);

      const result = await service.isBlocked('team-1', 'team-2');

      expect(result).toBe(false);
    });

    it('should check bidirectionally', async () => {
      mockTeamBlockModel.findFirst.mockResolvedValue(null);

      await service.isBlocked('team-1', 'team-2');

      expect(mockTeamBlockModel.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { blockingTeamId: 'team-1', blockedTeamId: 'team-2' },
            { blockingTeamId: 'team-2', blockedTeamId: 'team-1' },
          ],
        },
      });
    });
  });
});
