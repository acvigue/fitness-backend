import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockMessage = { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() };
const mockUserSuspension = {
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
};
const mockUserBan = {
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
};
const mockUserRestriction = {
  create: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    message: mockMessage,
    userSuspension: mockUserSuspension,
    userBan: mockUserBan,
    userRestriction: mockUserRestriction,
  },
  redis: {},
  redisSub: {},
}));

const { ModerationService } = await import('../moderation.service');
const { AuditService } = await import('@/rest/audit/audit.service');
const { NotificationService } = await import('@/rest/notification/notification.service');

const NOW = new Date('2026-01-01T00:00:00Z');

describe('ModerationService', () => {
  let service: InstanceType<typeof ModerationService>;
  const auditService = { log: vi.fn().mockResolvedValue(undefined), findByTarget: vi.fn() };
  const notificationService = {
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue(0),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: AuditService, useValue: auditService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();
    service = module.get(ModerationService);
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('deleteMessage', () => {
    it('rejects missing message', async () => {
      mockMessage.findUnique.mockResolvedValue(null);
      await expect(service.deleteMessage('m-1', { reason: 'x' }, 'mgr-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects already deleted', async () => {
      mockMessage.findUnique.mockResolvedValue({
        id: 'm-1',
        senderId: 'u-1',
        deletedAt: NOW,
      });
      await expect(service.deleteMessage('m-1', { reason: 'x' }, 'mgr-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('soft-deletes, logs audit, and notifies author', async () => {
      mockMessage.findUnique.mockResolvedValue({
        id: 'm-1',
        senderId: 'u-1',
        deletedAt: null,
      });
      mockMessage.update.mockResolvedValue({});

      await service.deleteMessage('m-1', { reason: 'spam' }, 'mgr-1');

      expect(mockMessage.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: expect.objectContaining({
          deletedById: 'mgr-1',
          deletionReason: 'spam',
        }),
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MESSAGE_DELETED', targetId: 'm-1' })
      );
      expect(notificationService.create).toHaveBeenCalledWith(
        'u-1',
        'MESSAGE_DELETED',
        expect.any(String),
        expect.stringContaining('spam')
      );
    });
  });

  describe('flagMessage', () => {
    it('hides the message and logs', async () => {
      mockMessage.findUnique.mockResolvedValue({ id: 'm-1', senderId: 'u-1' });
      mockMessage.update.mockResolvedValue({});

      await service.flagMessage('m-1', { reason: 'off-topic' }, 'mgr-1');

      expect(mockMessage.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: expect.objectContaining({ hiddenById: 'mgr-1' }),
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MESSAGE_FLAGGED' })
      );
    });
  });

  describe('suspendUser', () => {
    it('creates suspension with computed endsAt', async () => {
      mockUserSuspension.create.mockResolvedValue({ id: 'sus-1' });
      await service.suspendUser('u-1', { durationHours: 24, reason: 'abuse' }, 'mgr-1');

      expect(mockUserSuspension.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u-1',
          issuedById: 'mgr-1',
          reason: 'abuse',
          endsAt: expect.any(Date),
        }),
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_SUSPENDED' })
      );
    });
  });

  describe('unsuspendUser', () => {
    it('throws when no active suspension', async () => {
      mockUserSuspension.findFirst.mockResolvedValue(null);
      await expect(service.unsuspendUser('u-1', 'mgr-1')).rejects.toThrow(NotFoundException);
    });

    it('revokes active suspension', async () => {
      mockUserSuspension.findFirst.mockResolvedValue({ id: 'sus-1' });
      mockUserSuspension.update.mockResolvedValue({});
      await service.unsuspendUser('u-1', 'mgr-1');
      expect(mockUserSuspension.update).toHaveBeenCalledWith({
        where: { id: 'sus-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('banUser / unbanUser', () => {
    it('creates a ban record', async () => {
      mockUserBan.create.mockResolvedValue({ id: 'ban-1' });
      await service.banUser('u-1', { reason: 'severe' }, 'mgr-1');
      expect(mockUserBan.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_BANNED' })
      );
    });

    it('requires active ban to unban', async () => {
      mockUserBan.findFirst.mockResolvedValue(null);
      await expect(service.unbanUser('u-1', 'mgr-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('restrictUser', () => {
    it('creates a restriction per requested action', async () => {
      mockUserRestriction.create.mockResolvedValue({});
      await service.restrictUser(
        'u-1',
        { actions: ['MESSAGING', 'TEAM_JOIN'], durationHours: 48, reason: 'warning' },
        'mgr-1'
      );
      expect(mockUserRestriction.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('assertAllowed', () => {
    it('passes when no active restriction', async () => {
      mockUserRestriction.findFirst.mockResolvedValue(null);
      await expect(service.assertAllowed('u-1', 'MESSAGING')).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when restriction is active', async () => {
      mockUserRestriction.findFirst.mockResolvedValue({ id: 'r-1', reason: 'warning' });
      await expect(service.assertAllowed('u-1', 'MESSAGING')).rejects.toThrow(ForbiddenException);
    });
  });
});
