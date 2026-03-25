import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockTeam = {
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    team: mockTeam,
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        team: mockTeam,
        //organizationMember: mockOrganizationMember,
      })
    ),
  },
  redis: {},
  redisSub: {},
}));

// Must be imported after vi.mock so the mock is in place
const { TeamService } = await import('../team.service');


const NOW = new Date('2026-01-01T00:00:00Z');

function mockT(overrides: Record<string, unknown> = {}) {
  return {
    id: 'team-1',
    name: 'Test Team',
	captainId: 'captain-1',
	sportId: 'sport-1'
    ...overrides,
  };
}

describe('TeamService', () => {
  let service: InstanceType<typeof TeamService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [TeamService],
    }).compile();

    service = module.get(TeamService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── update ──────────────────────────────────────────

  describe('updateCaptain', () => {
    it('should update team captain when user is team captain', async () => {
      const result = await service.updateCaptain('team-1', { captainId: 'captain-2' }, 'captain-1');

      expect(result.captainId).toBe('captain-2');
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      await expect(service.update('team-1', { name: 'X' }, 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // ─── delete ──────────────────────────────────────────

  describe('delete', () => {
    it('should delete team when user is captain', async () => {
	  mockTeam.findUnique.mockResolvedValue(mockT());
      mockTeam.delete.mockResolvedValue(mockT());

      await service.delete('team-1', 'captain-1');

      expect(mockOrganization.delete).toHaveBeenCalledWith({ where: { id: 'team-1' } });
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      await expect(service.delete('team-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
	
    it('should throw NotFoundException when organization does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(service.delete('team-1', 'captain-1')).rejects.toThrow(NotFoundException);
    });
  });

});
