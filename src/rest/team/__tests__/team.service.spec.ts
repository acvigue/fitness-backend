import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockTeam = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockTeamInvitation = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockUser = {
  findUnique: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    team: mockTeam,
    teamInvitation: mockTeamInvitation,
    user: mockUser,
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        team: mockTeam,
        teamInvitation: mockTeamInvitation,
        user: mockUser,
      })
    ),
  },
  redis: {},
  redisSub: {},
}));

const { TeamService } = await import('../team.service');
const { NotificationService } = await import('../../notification/notification.service');
const { UserService } = await import('../../user/user.service');

const mockNotificationService = {
  create: vi.fn().mockResolvedValue({}),
};

const mockUserService = {
  getProfile: vi.fn(),
};

const mockProfile = {
  userId: 'user-2',
  bio: 'Test bio',
  favoriteSports: [],
  pictures: [],
  featuredAchievements: [],
};

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

const NOW = new Date('2026-01-01T00:00:00Z');

function mockInv(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    teamId: 'team-1',
    userId: 'user-2',
    type: 'INVITE',
    status: 'PENDING',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('TeamService', () => {
  let service: InstanceType<typeof TeamService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TeamService,
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: UserService, useValue: mockUserService },
      ],
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

    it('should send notifications to both old and new captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());
      mockTeam.update.mockResolvedValue(mockT({ captainId: 'captain-2' }));

      await service.updateCaptain('team-1', { captainId: 'captain-2' }, 'captain-1');

      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'captain-2',
        'CAPTAIN_ASSIGNED',
        'Captain Role Assigned',
        expect.stringContaining('Test Team')
      );
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'captain-1',
        'CAPTAIN_TRANSFERRED',
        'Captain Role Transferred',
        expect.stringContaining('Test Team')
      );
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
      mockTeam.findUnique.mockResolvedValue(mockT({ users: [{ id: 'captain-1' }] }));
      mockTeam.delete.mockResolvedValue(mockT());

      await service.delete('team-1', 'captain-1');

      expect(mockTeam.delete).toHaveBeenCalledWith({
        where: { id: 'team-1' },
      });
    });

    it('should notify members when team is deleted', async () => {
      mockTeam.findUnique.mockResolvedValue(
        mockT({ users: [{ id: 'captain-1' }, { id: 'user-2' }, { id: 'user-3' }] })
      );
      mockTeam.delete.mockResolvedValue(mockT());

      await service.delete('team-1', 'captain-1');

      expect(mockNotificationService.create).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'user-2',
        'TEAM_DELETED',
        'Team Disbanded',
        expect.stringContaining('Test Team')
      );
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTeam.findUnique.mockResolvedValue(
        mockT({ captainId: 'captain-1', users: [{ id: 'captain-1' }] })
      );

      await expect(service.delete('team-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(service.delete('team-1', 'captain-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Members ─────────────────────────────────────────────

  describe('leaveTeam', () => {
    it('should allow a member to leave the team', async () => {
      mockTeam.findUnique.mockResolvedValue(
        mockT({ users: [{ id: 'captain-1' }, { id: 'user-2' }] })
      );
      mockTeam.update.mockResolvedValue(mockT());

      await service.leaveTeam('team-1', 'user-2');

      expect(mockTeam.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { users: { disconnect: { id: 'user-2' } } },
      });
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'captain-1',
        'MEMBER_LEFT',
        'Member Left Team',
        expect.stringContaining('Test Team')
      );
    });

    it('should throw BadRequestException when captain tries to leave', async () => {
      mockTeam.findUnique.mockResolvedValue(
        mockT({ users: [{ id: 'captain-1' }, { id: 'user-2' }] })
      );

      await expect(service.leaveTeam('team-1', 'captain-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not a member', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT({ users: [{ id: 'captain-1' }] }));

      await expect(service.leaveTeam('team-1', 'user-3')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(service.leaveTeam('team-1', 'user-2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('should allow captain to remove a member', async () => {
      mockTeam.findUnique.mockResolvedValue(
        mockT({ users: [{ id: 'captain-1' }, { id: 'user-2' }] })
      );
      mockTeam.update.mockResolvedValue(mockT());

      await service.removeMember('team-1', 'user-2', 'captain-1');

      expect(mockTeam.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { users: { disconnect: { id: 'user-2' } } },
      });
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'user-2',
        'REMOVED_FROM_TEAM',
        'Removed from Team',
        expect.stringContaining('Test Team')
      );
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTeam.findUnique.mockResolvedValue(
        mockT({ users: [{ id: 'captain-1' }, { id: 'user-2' }] })
      );

      await expect(service.removeMember('team-1', 'user-2', 'user-3')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw BadRequestException when captain tries to remove themselves', async () => {
      mockTeam.findUnique.mockResolvedValue(
        mockT({ users: [{ id: 'captain-1' }, { id: 'user-2' }] })
      );

      await expect(service.removeMember('team-1', 'captain-1', 'captain-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when target is not a member', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT({ users: [{ id: 'captain-1' }] }));

      await expect(service.removeMember('team-1', 'user-3', 'captain-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('team-1', 'user-2', 'captain-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ─── Invitations ───────────────────────────────────────

  describe('sendInvitation', () => {
    it('should send an invitation when user is captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());
      mockTeamInvitation.findFirst.mockResolvedValue(null);
      mockTeamInvitation.create.mockResolvedValue(mockInv());

      const result = await service.sendInvitation('team-1', 'user-2', 'captain-1');

      expect(result.type).toBe('INVITE');
      expect(result.status).toBe('PENDING');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'user-2',
        'TEAM_INVITE',
        'Team Invitation',
        expect.stringContaining('Test Team')
      );
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());

      await expect(service.sendInvitation('team-1', 'user-2', 'user-3')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw BadRequestException when invitation already pending', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());
      mockTeamInvitation.findFirst.mockResolvedValue(mockInv());

      await expect(service.sendInvitation('team-1', 'user-2', 'captain-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(service.sendInvitation('team-1', 'user-2', 'captain-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('requestToJoin', () => {
    it('should create a join request', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());
      mockTeamInvitation.findFirst.mockResolvedValue(null);
      mockTeamInvitation.create.mockResolvedValue(mockInv({ type: 'REQUEST', userId: 'user-2' }));

      const result = await service.requestToJoin('team-1', 'user-2');

      expect(result.type).toBe('REQUEST');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'captain-1',
        'TEAM_JOIN_REQUEST',
        'Join Request',
        expect.stringContaining('Test Team')
      );
    });

    it('should throw BadRequestException when request already pending', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());
      mockTeamInvitation.findFirst.mockResolvedValue(mockInv({ type: 'REQUEST' }));

      await expect(service.requestToJoin('team-1', 'user-2')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(service.requestToJoin('team-1', 'user-2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('respondToInvitation', () => {
    it('should accept an invite and add user to team', async () => {
      mockTeamInvitation.findUnique.mockResolvedValue(mockInv({ team: mockT() }));
      mockTeamInvitation.update.mockResolvedValue(mockInv({ status: 'ACCEPTED' }));
      mockTeam.update.mockResolvedValue(mockT());

      const result = await service.respondToInvitation('inv-1', 'user-2', true);

      expect(result.status).toBe('ACCEPTED');
      expect(mockTeam.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { users: { connect: { id: 'user-2' } } },
      });
    });

    it('should decline an invite without adding user', async () => {
      mockTeamInvitation.findUnique.mockResolvedValue(mockInv({ team: mockT() }));
      mockTeamInvitation.update.mockResolvedValue(mockInv({ status: 'DECLINED' }));

      const result = await service.respondToInvitation('inv-1', 'user-2', false);

      expect(result.status).toBe('DECLINED');
      expect(mockTeam.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when wrong user responds to invite', async () => {
      mockTeamInvitation.findUnique.mockResolvedValue(mockInv({ team: mockT() }));

      await expect(service.respondToInvitation('inv-1', 'user-3', true)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should allow captain to respond to join requests', async () => {
      mockTeamInvitation.findUnique.mockResolvedValue(mockInv({ type: 'REQUEST', team: mockT() }));
      mockTeamInvitation.update.mockResolvedValue(mockInv({ type: 'REQUEST', status: 'ACCEPTED' }));
      mockTeam.update.mockResolvedValue(mockT());

      const result = await service.respondToInvitation('inv-1', 'captain-1', true);

      expect(result.status).toBe('ACCEPTED');
    });

    it('should throw BadRequestException when invitation already responded to', async () => {
      mockTeamInvitation.findUnique.mockResolvedValue(
        mockInv({ status: 'ACCEPTED', team: mockT() })
      );

      await expect(service.respondToInvitation('inv-1', 'user-2', true)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException when invitation does not exist', async () => {
      mockTeamInvitation.findUnique.mockResolvedValue(null);

      await expect(service.respondToInvitation('inv-1', 'user-2', true)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('cancelInvitation', () => {
    it('should cancel a pending invitation when user is captain', async () => {
      mockTeamInvitation.findUnique.mockResolvedValue(mockInv({ team: mockT() }));
      mockTeamInvitation.delete.mockResolvedValue(mockInv());

      await service.cancelInvitation('inv-1', 'captain-1');

      expect(mockTeamInvitation.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTeamInvitation.findUnique.mockResolvedValue(mockInv({ team: mockT() }));

      await expect(service.cancelInvitation('inv-1', 'user-2')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when invitation is not pending', async () => {
      mockTeamInvitation.findUnique.mockResolvedValue(
        mockInv({ status: 'ACCEPTED', team: mockT() })
      );

      await expect(service.cancelInvitation('inv-1', 'captain-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException when invitation does not exist', async () => {
      mockTeamInvitation.findUnique.mockResolvedValue(null);

      await expect(service.cancelInvitation('inv-1', 'captain-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getTeamInvitations', () => {
    it('should return pending invitations for team captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());
      mockTeamInvitation.findMany.mockResolvedValue([mockInv(), mockInv({ id: 'inv-2' })]);

      const result = await service.getTeamInvitations('team-1', 'captain-1');

      expect(result).toHaveLength(2);
    });

    it('should throw ForbiddenException when user is not captain', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT());

      await expect(service.getTeamInvitations('team-1', 'user-2')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('getUserInvitations', () => {
    it('should return pending invitations for a user', async () => {
      mockTeamInvitation.findMany.mockResolvedValue([mockInv()]);

      const result = await service.getUserInvitations('user-2');

      expect(result).toHaveLength(1);
      expect(mockTeamInvitation.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-2', type: 'INVITE', status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ─── getMemberProfile ───────────────────────────────────

  describe('getMemberProfile', () => {
    it('should return member profile with isCaptain flag', async () => {
      mockTeam.findUnique.mockResolvedValue(
        mockT({ users: [{ id: 'captain-1' }, { id: 'user-2' }] })
      );
      mockUser.findUnique.mockResolvedValue({
        id: 'user-2',
        username: 'jane',
        name: 'Jane',
        email: 'jane@test.com',
      });
      mockUserService.getProfile.mockResolvedValue(mockProfile);

      const result = await service.getMemberProfile('team-1', 'user-2');

      expect(result.userId).toBe('user-2');
      expect(result.isCaptain).toBe(false);
      expect(result.profile).toEqual(mockProfile);
    });

    it('should set isCaptain to true for the captain', async () => {
      mockTeam.findUnique.mockResolvedValue(
        mockT({ users: [{ id: 'captain-1' }, { id: 'user-2' }] })
      );
      mockUser.findUnique.mockResolvedValue({
        id: 'captain-1',
        username: 'cap',
        name: 'Captain',
        email: 'cap@test.com',
      });
      mockUserService.getProfile.mockResolvedValue({ ...mockProfile, userId: 'captain-1' });

      const result = await service.getMemberProfile('team-1', 'captain-1');

      expect(result.isCaptain).toBe(true);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeam.findUnique.mockResolvedValue(null);

      await expect(service.getMemberProfile('team-1', 'user-2')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user is not a member', async () => {
      mockTeam.findUnique.mockResolvedValue(mockT({ users: [{ id: 'captain-1' }] }));

      await expect(service.getMemberProfile('team-1', 'user-99')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
