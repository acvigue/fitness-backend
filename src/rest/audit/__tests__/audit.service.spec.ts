import { Test } from '@nestjs/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuditLog = {
  create: vi.fn(),
  findMany: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: { auditLog: mockAuditLog },
  redis: {},
  redisSub: {},
}));

const { AuditService } = await import('../audit.service');

describe('AuditService', () => {
  let service: InstanceType<typeof AuditService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [AuditService] }).compile();
    service = module.get(AuditService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('persists an audit entry with all fields', async () => {
      mockAuditLog.create.mockResolvedValue({});

      await service.log({
        actorId: 'mgr-1',
        action: 'MESSAGE_DELETED',
        targetType: 'Message',
        targetId: 'm-1',
        reason: 'spam',
        metadata: { chatId: 'c-1' },
      });

      expect(mockAuditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'mgr-1',
          action: 'MESSAGE_DELETED',
          targetType: 'Message',
          targetId: 'm-1',
          reason: 'spam',
          metadata: { chatId: 'c-1' },
        },
      });
    });

    it('accepts optional reason and metadata', async () => {
      mockAuditLog.create.mockResolvedValue({});
      await service.log({
        actorId: 'mgr-1',
        action: 'USER_SUSPENDED',
        targetType: 'User',
        targetId: 'u-1',
      });

      expect(mockAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'mgr-1',
          action: 'USER_SUSPENDED',
          reason: undefined,
          metadata: undefined,
        }),
      });
    });
  });

  describe('findByTarget', () => {
    it('returns logs ordered by createdAt desc', async () => {
      mockAuditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      const result = await service.findByTarget('Message', 'm-1');
      expect(mockAuditLog.findMany).toHaveBeenCalledWith({
        where: { targetType: 'Message', targetId: 'm-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });
});
