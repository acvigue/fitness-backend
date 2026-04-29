import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockUserModel = {
  findUnique: vi.fn(),
};

const mockReportModel = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
};

const mockOrganizationMemberModel = {
  findFirst: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    user: mockUserModel,
    report: mockReportModel,
    organizationMember: mockOrganizationMemberModel,
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
      mockUserModel.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Reported' });
      mockReportModel.findFirst.mockResolvedValueOnce(null);
      mockReportModel.create.mockResolvedValue({
        id: 'report-1',
        userId1: 'user-1',
        userId2: 'user-2',
        messageId: null,
        reason: 'Harassment',
        status: 'PENDING',
        createdAt: NOW,
      });

      const result = await service.create({ reportedId: 'user-2', reason: 'Harassment' }, 'user-1');

      expect(result).toEqual({
        id: 'report-1',
        reporterId: 'user-1',
        reportedId: 'user-2',
        messageId: null,
        reason: 'Harassment',
        status: 'PENDING',
        createdAt: NOW,
      });
    });

    it('should call prisma.report.create with correct data', async () => {
      mockUserModel.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Reported' });
      mockReportModel.findFirst.mockResolvedValueOnce(null);
      mockReportModel.create.mockResolvedValue({
        id: 'report-1',
        userId1: 'user-1',
        userId2: 'user-2',
        messageId: null,
        reason: 'Spam',
        status: 'PENDING',
        createdAt: NOW,
      });

      await service.create({ reportedId: 'user-2', reason: 'Spam' }, 'user-1');

      expect(mockReportModel.create).toHaveBeenCalledWith({
        data: {
          userId1: 'user-1',
          userId2: 'user-2',
          messageId: null,
          reason: 'Spam',
          status: 'PENDING',
        },
      });
    });

    it('should throw NotFoundException when reported user does not exist', async () => {
      mockUserModel.findUnique.mockResolvedValueOnce(null);

      await expect(service.create({ reportedId: 'missing' }, 'user-1')).rejects.toThrow(
        NotFoundException
      );

      expect(mockReportModel.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when reporting yourself', async () => {
      await expect(service.create({ reportedId: 'user-1' }, 'user-1')).rejects.toThrow(
        BadRequestException
      );

      expect(mockReportModel.create).not.toHaveBeenCalled();
    });

    it('should handle undefined reason', async () => {
      mockUserModel.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Reported' });
      mockReportModel.findFirst.mockResolvedValueOnce(null);
      mockReportModel.create.mockResolvedValue({
        id: 'report-1',
        userId1: 'user-1',
        userId2: 'user-2',
        reason: null,
        status: 'PENDING',
        createdAt: NOW,
      });

      const result = await service.create({ reportedId: 'user-2' }, 'user-1');

      expect(result.reason).toBeNull();
    });

    it('should throw BadRequestException for duplicate report', async () => {
      mockUserModel.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Reported' });
      mockReportModel.findFirst.mockResolvedValueOnce({
        id: 'report-1',
        userId1: 'user-1',
        userId2: 'user-2',
      });

      await expect(
        service.create({ reportedId: 'user-2', reason: 'Harassment' }, 'user-1')
      ).rejects.toThrow(BadRequestException);

      expect(mockReportModel.create).not.toHaveBeenCalled();
    });
  });

  // ─── get ────────────────────────────────────────────

  describe('get', () => {
    const PAGINATION = { page: 1, per_page: 20 };

    it('should return all reports for an org admin', async () => {
      mockOrganizationMemberModel.findFirst.mockResolvedValueOnce({ id: 'member-1' });
      mockReportModel.count.mockResolvedValue(2);
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

      const result = await service.getAllReports('admin-1', PAGINATION);

      expect(result.data).toEqual([
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
      expect(result.meta.total).toBe(2);
    });

    it('should throw when requester is not an org admin', async () => {
      mockOrganizationMemberModel.findFirst.mockResolvedValueOnce(null);

      await expect(service.getAllReports('non-admin', PAGINATION)).rejects.toThrow();

      expect(mockReportModel.findMany).not.toHaveBeenCalled();
    });

    it('should return only reports that the user made', async () => {
      mockReportModel.count.mockResolvedValue(1);
      mockReportModel.findMany.mockResolvedValue([
        {
          userId1: 'user-1',
          userId2: 'user-2',
          reason: 'Harassment',
          status: 'PENDING',
          createdAt: NOW,
        },
      ]);

      const result = await service.getReportsForUser('user-1', PAGINATION);

      expect(result.data).toEqual([
        {
          reporterId: 'user-1',
          reportedId: 'user-2',
          reason: 'Harassment',
          status: 'PENDING',
          createdAt: NOW,
        },
      ]);
      expect(result.meta.total).toBe(1);
    });
  });

  // ─── updateStatus ────────────────────────────────────────────

  describe('updateStatus', () => {
    it('rejects non-org-admin requesters', async () => {
      mockOrganizationMemberModel.findFirst.mockResolvedValueOnce(null);

      await expect(service.updateStatus('report-1', 'RESOLVED', 'non-admin')).rejects.toThrow(
        ForbiddenException
      );
      expect(mockReportModel.findUnique).not.toHaveBeenCalled();
      expect(mockReportModel.update).not.toHaveBeenCalled();
    });

    it('updates the status when caller is an org admin', async () => {
      mockOrganizationMemberModel.findFirst.mockResolvedValueOnce({ id: 'member-1' });
      mockReportModel.findUnique.mockResolvedValueOnce({ id: 'report-1' });
      mockReportModel.update.mockResolvedValue({
        userId1: 'user-1',
        userId2: 'user-2',
        reason: 'Harassment',
        status: 'RESOLVED',
        createdAt: NOW,
      });

      const result = await service.updateStatus('report-1', 'RESOLVED', 'admin-1');

      expect(result).toEqual({
        reporterId: 'user-1',
        reportedId: 'user-2',
        reason: 'Harassment',
        status: 'RESOLVED',
        createdAt: NOW,
      });
    });

    it('throws NotFoundException when the report does not exist', async () => {
      mockOrganizationMemberModel.findFirst.mockResolvedValueOnce({ id: 'member-1' });
      mockReportModel.findUnique.mockResolvedValueOnce(null);

      await expect(service.updateStatus('missing-report', 'RESOLVED', 'admin-1')).rejects.toThrow(
        NotFoundException
      );
      expect(mockReportModel.update).not.toHaveBeenCalled();
    });
  });
});
