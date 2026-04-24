import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = { findUnique: vi.fn() };
const mockUserBlock = {
  upsert: vi.fn(),
  findUnique: vi.fn(),
  delete: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: { user: mockUser, userBlock: mockUserBlock },
  redis: {},
  redisSub: {},
}));

const { UserBlockService } = await import('../user-block.service');

const NOW = new Date('2026-01-01T00:00:00Z');

describe('UserBlockService', () => {
  let service: InstanceType<typeof UserBlockService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [UserBlockService] }).compile();
    service = module.get(UserBlockService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('block', () => {
    it('rejects self-block', async () => {
      await expect(service.block('u-1', 'u-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects missing target user', async () => {
      mockUser.findUnique.mockResolvedValue(null);
      await expect(service.block('u-1', 'u-2')).rejects.toThrow(NotFoundException);
    });

    it('creates block idempotently', async () => {
      mockUser.findUnique.mockResolvedValue({ id: 'u-2' });
      mockUserBlock.upsert.mockResolvedValue({
        id: 'b-1',
        blockerId: 'u-1',
        blockedId: 'u-2',
        createdAt: NOW,
      });
      const result = await service.block('u-1', 'u-2');
      expect(result.blockerId).toBe('u-1');
      expect(mockUserBlock.upsert).toHaveBeenCalled();
    });
  });

  describe('unblock', () => {
    it('rejects when block not found', async () => {
      mockUserBlock.findUnique.mockResolvedValue(null);
      await expect(service.unblock('u-1', 'u-2')).rejects.toThrow(NotFoundException);
    });

    it('deletes the block', async () => {
      mockUserBlock.findUnique.mockResolvedValue({ id: 'b-1' });
      await service.unblock('u-1', 'u-2');
      expect(mockUserBlock.delete).toHaveBeenCalledWith({ where: { id: 'b-1' } });
    });
  });

  describe('isBlocked', () => {
    it('returns true if either direction exists', async () => {
      mockUserBlock.count.mockResolvedValue(1);
      expect(await service.isBlocked('a', 'b')).toBe(true);
      expect(mockUserBlock.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { blockerId: 'a', blockedId: 'b' },
            { blockerId: 'b', blockedId: 'a' },
          ],
        },
      });
    });

    it('returns false when none exists', async () => {
      mockUserBlock.count.mockResolvedValue(0);
      expect(await service.isBlocked('a', 'b')).toBe(false);
    });
  });

  describe('didBlock', () => {
    it('returns true only when a specific direction exists', async () => {
      mockUserBlock.count.mockResolvedValue(1);
      expect(await service.didBlock('a', 'b')).toBe(true);
      expect(mockUserBlock.count).toHaveBeenCalledWith({
        where: { blockerId: 'a', blockedId: 'b' },
      });
    });
  });

  describe('listBlocks', () => {
    it('returns blocker’s block list', async () => {
      mockUserBlock.findMany.mockResolvedValue([
        { id: 'b-1', blockerId: 'u-1', blockedId: 'u-2', createdAt: NOW },
      ]);
      const result = await service.listBlocks('u-1');
      expect(result).toHaveLength(1);
    });
  });
});
