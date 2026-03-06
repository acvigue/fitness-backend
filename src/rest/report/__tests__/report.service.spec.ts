import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockUserModel = {
  findUnique: vi.fn(),
};

const mockReportModel = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    user: mockUserModel,
    report: mockReportModel,
  },
  redis: {},
  redisSub: {},
}));

const { ReportService } = await import('../report.service');

const NOW = new Date('2026-01-01T00:00:00Z');

describe('ReportService', () => {
  let service: InstanceType<typeof ReportService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [ReportService],
    }).compile();

    service = module.get(ReportService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── create ────────────────────────────────────────────

  describe('create', () => {
    it('should create a report and return the response', async () => {
      mockUserModel.findUnique
        .mockResolvedValueOnce({ id: 'user-1', name: 'Reporter' })
        .mockResolvedValueOnce({ id: 'user-2', name: 'Reported' });
      mockReportModel.create.mockResolvedValue({
        id: 'report-1',
        userId1: 'user-1',
        userId2: 'user-2',
        reason: 'Harassment',
        status: 'PENDING',
        createdAt: NOW,
      });

      const result = await service.create(
        {
          reporterId: 'user-1',
          reportedId: 'user-2',
          reason: 'Harassment',
          status: 'PENDING',
          createdAt: NOW,
        },
        'user-1'
      );

      expect(result).toEqual({
        reporterId: 'user-1',
        reportedId: 'user-2',
        reason: 'Harassment',
        status: 'PENDING',
        createdAt: NOW,
      });
    });

    it('should call prisma.report.create with correct data', async () => {
      mockUserModel.findUnique
        .mockResolvedValueOnce({ id: 'user-1', name: 'Reporter' })
        .mockResolvedValueOnce({ id: 'user-2', name: 'Reported' });
      mockReportModel.create.mockResolvedValue({
        id: 'report-1',
        userId1: 'user-1',
        userId2: 'user-2',
        reason: 'Spam',
        status: 'PENDING',
        createdAt: NOW,
      });

      await service.create(
        {
          reporterId: 'user-1',
          reportedId: 'user-2',
          reason: 'Spam',
          status: 'PENDING',
          createdAt: NOW,
        },
        'user-1'
      );

      expect(mockReportModel.create).toHaveBeenCalledWith({
        data: {
          userId1: 'user-1',
          userId2: 'user-2',
          reason: 'Spam',
          status: 'PENDING',
        },
      });
    });

    it('should throw NotFoundException when reporter does not exist', async () => {
      mockUserModel.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            reporterId: 'missing',
            reportedId: 'user-2',
            reason: null,
            status: 'PENDING',
            createdAt: NOW,
          },
          'missing'
        )
      ).rejects.toThrow(NotFoundException);

      expect(mockReportModel.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when reported user does not exist', async () => {
      mockUserModel.findUnique
        .mockResolvedValueOnce({ id: 'user-1', name: 'Reporter' })
        .mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            reporterId: 'user-1',
            reportedId: 'missing',
            reason: null,
            status: 'PENDING',
            createdAt: NOW,
          },
          'user-1'
        )
      ).rejects.toThrow(NotFoundException);

      expect(mockReportModel.create).not.toHaveBeenCalled();
    });

    it('should handle null reason', async () => {
      mockUserModel.findUnique
        .mockResolvedValueOnce({ id: 'user-1', name: 'Reporter' })
        .mockResolvedValueOnce({ id: 'user-2', name: 'Reported' });
      mockReportModel.create.mockResolvedValue({
        id: 'report-1',
        userId1: 'user-1',
        userId2: 'user-2',
        reason: null,
        status: 'PENDING',
        createdAt: NOW,
      });

      const result = await service.create(
        {
          reporterId: 'user-1',
          reportedId: 'user-2',
          reason: null,
          status: 'PENDING',
          createdAt: NOW,
        },
        'user-1'
      );

      expect(result.reason).toBeNull();
    });
    it('should handle if a user reports another user multiple times', async () => {
      mockReportModel.create.mockResolvedValue({
        id: 'report-1',
        userId1: 'user-1',
        userId2: 'user-2',
        reason: 'Harassment',
        status: 'OPEN',
        createdAt: NOW,
      });
      await expect(
        service.create(
          {
            reporterId: 'user-1',
            reportedId: 'user-2',
            reason: null,
            status: 'PENDING',
            createdAt: NOW,
          },
          'user-1'
        )
      ).rejects.toThrow(Error);

      expect(mockReportModel.create).not.toHaveBeenCalled();
    });
  });

  // ─── get ────────────────────────────────────────────
  describe('get', () => {
    it('should return all reports', async () => {
      mockReportModel.create.mockResolvedValue({
        userId1: 'user-2',
        userId2: 'user-1',
        reason: 'Harassment',
        status: 'PENDING',
        createdAt: NOW,
      });
      mockReportModel.findMany.mockResolvedValue([
        {
          userId1: 'user-1',
          userId2: 'user-2',
          reason: 'Harassment',
          status: 'PENDING',
          createdAt: NOW,
        },
        {
          userId1: 'user-2',
          userId2: 'user-1',
          reason: 'Harassment',
          status: 'PENDING',
          createdAt: NOW,
        },
      ]);
      const result = await service.getAllReports();
      expect(result).toEqual([
        {
          reporterId: 'user-1',
          reportedId: 'user-2',
          reason: 'Harassment',
          status: 'PENDING',
          createdAt: NOW,
        },
        {
          reporterId: 'user-2',
          reportedId: 'user-1',
          reason: 'Harassment',
          status: 'PENDING',
          createdAt: NOW,
        },
      ]);
    });
    it('should return only reports that the user made', async () => {
      mockReportModel.findMany.mockResolvedValue([
        {
          userId1: 'user-1',
          userId2: 'user-2',
          reason: 'Harassment',
          status: 'PENDING',
          createdAt: NOW,
        },
      ]);
      const result = await service.getReportsForUser('user-1');
      expect(result).toEqual([
        {
          reporterId: 'user-1',
          reportedId: 'user-2',
          reason: 'Harassment',
          status: 'PENDING',
          createdAt: NOW,
        },
      ]);
    });
  });
  // ─── update ────────────────────────────────────────────
  describe('update', () => {
    it('should update the status of the report', async () => {
      mockReportModel.update.mockResolvedValue({
        userId1: 'user-1',
        userId2: 'user-2',
        reason: 'Harassment',
        status: 'RESOLVED',
        createdAt: NOW,
      });
      const result = await service.updateStatus('user-1', 'user-2', 'RESOLVED');
      expect(result).toEqual({
        reporterId: 'user-1',
        reportedId: 'user-2',
        reason: 'Harassment',
        status: 'RESOLVED',
        createdAt: NOW,
      });
    });
    it('should throw an error when the status string does not match a possible status', async () => {
      await expect(service.updateStatus('user-1', 'user-2', 'RESOewfiufweiLVED')).rejects.toThrow(
        Error
      );
      expect(mockReportModel.update).not.toHaveBeenCalled();
    });
  });
});
