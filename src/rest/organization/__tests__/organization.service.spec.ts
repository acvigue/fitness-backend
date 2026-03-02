import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockOrganization = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
};

const mockOrganizationMember = {
  findUnique: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    organization: mockOrganization,
    organizationMember: mockOrganizationMember,
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        organization: mockOrganization,
        organizationMember: mockOrganizationMember,
      })
    ),
  },
  redis: {},
  redisSub: {},
}));

// Must be imported after vi.mock so the mock is in place
const { OrganizationService } = await import('../organization.service');

const NOW = new Date('2026-01-01T00:00:00Z');

function mockOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-1',
    name: 'Test Org',
    createdAt: NOW,
    updatedAt: NOW,
    _count: { members: 3 },
    ...overrides,
  };
}

function mockMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    userId: 'user-1',
    organizationId: 'org-1',
    role: 'MEMBER' as const,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('OrganizationService', () => {
  let service: InstanceType<typeof OrganizationService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [OrganizationService],
    }).compile();

    service = module.get(OrganizationService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── create ──────────────────────────────────────────

  describe('create', () => {
    it('should create an organization and add the creator as ADMIN', async () => {
      const org = mockOrg({ _count: undefined });
      mockOrganization.create.mockResolvedValue(org);
      mockOrganizationMember.create.mockResolvedValue(mockMembership({ role: 'ADMIN' }));

      const result = await service.create({ name: 'Test Org' }, 'user-1');

      expect(result).toEqual({
        id: 'org-1',
        name: 'Test Org',
        memberCount: 1,
        createdAt: NOW,
        updatedAt: NOW,
      });
      expect(mockOrganization.create).toHaveBeenCalledWith({ data: { name: 'Test Org' } });
      expect(mockOrganizationMember.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', organizationId: 'org-1', role: 'ADMIN' },
      });
    });
  });

  // ─── findAll ─────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated organizations with member counts', async () => {
      const orgs = [mockOrg(), mockOrg({ id: 'org-2', name: 'Org 2', _count: { members: 5 } })];
      mockOrganization.count.mockResolvedValue(2);
      mockOrganization.findMany.mockResolvedValue(orgs);

      const result = await service.findAll({ page: 1, per_page: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].memberCount).toBe(3);
      expect(result.data[1].memberCount).toBe(5);
      expect(result.meta).toEqual({ page: 1, per_page: 10, total: 2, total_pages: 1 });
    });

    it('should pass correct skip/take for pagination', async () => {
      mockOrganization.count.mockResolvedValue(25);
      mockOrganization.findMany.mockResolvedValue([]);

      await service.findAll({ page: 3, per_page: 5 });

      expect(mockOrganization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 })
      );
    });
  });

  // ─── findOne ─────────────────────────────────────────

  describe('findOne', () => {
    it('should return a single organization with member count', async () => {
      mockOrganization.findUnique.mockResolvedValue(mockOrg());

      const result = await service.findOne('org-1');

      expect(result.id).toBe('org-1');
      expect(result.memberCount).toBe(3);
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      mockOrganization.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ──────────────────────────────────────────

  describe('update', () => {
    it('should update organization when user is ADMIN', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockOrganization.update.mockResolvedValue(mockOrg({ name: 'Updated' }));

      const result = await service.update('org-1', { name: 'Updated' }, 'user-1');

      expect(result.name).toBe('Updated');
    });

    it('should update organization when user is STAFF', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'STAFF' }));
      mockOrganization.update.mockResolvedValue(mockOrg({ name: 'Updated' }));

      const result = await service.update('org-1', { name: 'Updated' }, 'user-1');

      expect(result.name).toBe('Updated');
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }));

      await expect(service.update('org-1', { name: 'X' }, 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(null);

      await expect(service.update('org-1', { name: 'X' }, 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should pass conditional data when name is provided', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockOrganization.update.mockResolvedValue(mockOrg());

      await service.update('org-1', { name: 'New Name' }, 'user-1');

      expect(mockOrganization.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'New Name' } })
      );
    });

    it('should pass empty data when name is undefined', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockOrganization.update.mockResolvedValue(mockOrg());

      await service.update('org-1', {}, 'user-1');

      expect(mockOrganization.update).toHaveBeenCalledWith(expect.objectContaining({ data: {} }));
    });
  });

  // ─── delete ──────────────────────────────────────────

  describe('delete', () => {
    it('should delete organization when user is ADMIN', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockOrganization.findUnique.mockResolvedValue(mockOrg());
      mockOrganization.delete.mockResolvedValue(mockOrg());

      await service.delete('org-1', 'user-1');

      expect(mockOrganization.delete).toHaveBeenCalledWith({ where: { id: 'org-1' } });
    });

    it('should throw ForbiddenException when user is STAFF', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'STAFF' }));

      await expect(service.delete('org-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'MEMBER' }));

      await expect(service.delete('org-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(null);

      await expect(service.delete('org-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership({ role: 'ADMIN' }));
      mockOrganization.findUnique.mockResolvedValue(null);

      await expect(service.delete('org-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── join ────────────────────────────────────────────

  describe('join', () => {
    it('should create a MEMBER membership', async () => {
      mockOrganization.findUnique.mockResolvedValue(mockOrg());
      mockOrganizationMember.findUnique.mockResolvedValue(null);
      mockOrganizationMember.create.mockResolvedValue(mockMembership());

      const result = await service.join('org-1', 'user-1');

      expect(result.role).toBe('MEMBER');
      expect(mockOrganizationMember.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', organizationId: 'org-1', role: 'MEMBER' },
      });
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      mockOrganization.findUnique.mockResolvedValue(null);

      await expect(service.join('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when already a member', async () => {
      mockOrganization.findUnique.mockResolvedValue(mockOrg());
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership());

      await expect(service.join('org-1', 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  // ─── leave ───────────────────────────────────────────

  describe('leave', () => {
    it('should delete the membership', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(mockMembership());
      mockOrganizationMember.delete.mockResolvedValue(mockMembership());

      await service.leave('org-1', 'user-1');

      expect(mockOrganizationMember.delete).toHaveBeenCalledWith({
        where: { id: 'member-1' },
      });
    });

    it('should throw NotFoundException when not a member', async () => {
      mockOrganizationMember.findUnique.mockResolvedValue(null);

      await expect(service.leave('org-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
