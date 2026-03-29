import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockTeam = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    team: mockTeam,
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        team: mockTeam,
      })
    ),
  },
  redis: {},
  redisSub: {},
}));

const { TeamService } = await import('../team.service');

function mockT(overrides: Record<string, unknown> = {}) {
  return {
    id: 'team-1',
    name: 'Test Team',
    description: 'Test description',
    captainId: 'captain-1',
    sportId: 'sport-1',
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

  describe('findAll', () => {
    it('should return all teams', async () => {
      mockTeam.findMany.mockResolvedValue([mockT(), mockT({ id: 'team-2', name: 'Another Team' })]);

      const result = await service.findAll();

      expect(mockTeam.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        {
          id: 'team-1',
          name: 'Test Team',
          description: 'Test description',
          captainId: 'captain-1',
          sportId: 'sport-1',
        },
        {
          id: 'team-2',
          name: 'Another Team',
          description: 'Test description',
          captainId: 'captain-1',
          sportId: 'sport-1',
        },
      ]);
    });
  });

  describe('findOne', () => {
    it('should return one team when found', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());

      const result = await service.findOne('team-1');

      expect(mockTeam.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-1' },
      });
      expect(result).toEqual({
        id: 'team-1',
        name: 'Test Team',
        description: 'Test description',
        captainId: 'captain-1',
        sportId: 'sport-1',
      });
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(service.findOne('team-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a team and assign creator as captain', async () => {
      mockTeam.create.mockResolvedValue(mockT());

      const result = await service.create(
        {
          name: 'Test Team',
          description: 'Test description',
          sportId: 'sport-1',
        },
        'captain-1'
      );

      expect(mockTeam.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Team',
          description: 'Test description',
          captainId: 'captain-1',
          sportId: 'sport-1',
          users: {
            connect: [{ id: 'captain-1' }],
          },
        },
      });

      expect(result.captainId).toBe('captain-1');
    });

    it('should default description to empty string when omitted', async () => {
      mockTeam.create.mockResolvedValue(mockT({ description: '' }));

      await service.create(
        {
          name: 'Test Team',
          sportId: 'sport-1',
        },
        'captain-1'
      );

      expect(mockTeam.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Team',
          description: '',
          captainId: 'captain-1',
          sportId: 'sport-1',
          users: {
            connect: [{ id: 'captain-1' }],
          },
        },
      });
    });
  });

  describe('update', () => {
    it('should update team when user is captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());
      mockTeam.update.mockResolvedValue(
        mockT({
          name: 'Updated Team',
          description: 'Updated description',
          sportId: 'sport-2',
        })
      );

      const result = await service.update(
        'team-1',
        {
          name: 'Updated Team',
          description: 'Updated description',
          sportId: 'sport-2',
        },
        'captain-1'
      );

      expect(mockTeam.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: {
          name: 'Updated Team',
          description: 'Updated description',
          sportId: 'sport-2',
        },
      });

      expect(result).toEqual({
        id: 'team-1',
        name: 'Updated Team',
        description: 'Updated description',
        captainId: 'captain-1',
        sportId: 'sport-2',
      });
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT({ captainId: 'captain-1' }));

      await expect(
        service.update(
          'team-1',
          {
            name: 'Updated Team',
            description: 'Updated description',
            sportId: 'sport-2',
          },
          'user-1'
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          'team-1',
          {
            name: 'Updated Team',
            description: 'Updated description',
            sportId: 'sport-2',
          },
          'captain-1'
        )
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCaptain', () => {
    it('should update team captain when user is current captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());
      mockTeam.update.mockResolvedValue(mockT({ captainId: 'captain-2' }));

      const result = await service.updateCaptain('team-1', { captainId: 'captain-2' }, 'captain-1');

      expect(mockTeam.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { captainId: 'captain-2' },
      });
      expect(result.captainId).toBe('captain-2');
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT({ captainId: 'captain-1' }));

      await expect(
        service.updateCaptain('team-1', { captainId: 'captain-2' }, 'user-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCaptain('team-1', { captainId: 'captain-2' }, 'captain-1')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete team when user is captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());
      mockTeam.delete.mockResolvedValue(mockT());

      await service.delete('team-1', 'captain-1');

      expect(mockTeam.delete).toHaveBeenCalledWith({
        where: { id: 'team-1' },
      });
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT({ captainId: 'captain-1' }));

      await expect(service.delete('team-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(service.delete('team-1', 'captain-1')).rejects.toThrow(NotFoundException);
    });
  });
});
