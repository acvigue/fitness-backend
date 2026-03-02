import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';

const mockOrganizationMember = {
  findMany: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    organizationMember: mockOrganizationMember,
  },
  redis: {},
  redisSub: {},
}));

const { UserService } = await import('../user.service');

const NOW = new Date('2026-01-01T00:00:00Z');

function mockUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    sub: 'user-1',
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    scopes: ['openid', 'profile'],
    payload: { sub: 'user-1', iss: 'https://test-issuer.local' },
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
    organization: {
      id: 'org-1',
      name: 'Test Org',
      createdAt: NOW,
      updatedAt: NOW,
    },
    ...overrides,
  };
}

describe('UserService', () => {
  let service: InstanceType<typeof UserService>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [UserService],
    }).compile();

    service = module.get(UserService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getProfile ──────────────────────────────────────

  describe('getProfile', () => {
    it('should return the user profile from authenticated user', () => {
      const user = mockUser();
      const result = service.getProfile(user);

      expect(result).toEqual({
        sub: 'user-1',
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        scopes: ['openid', 'profile'],
      });
    });

    it('should handle optional fields being undefined', () => {
      const user = mockUser({
        username: undefined,
        name: undefined,
        email: undefined,
      });
      const result = service.getProfile(user);

      expect(result.sub).toBe('user-1');
      expect(result.username).toBeUndefined();
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.scopes).toEqual(['openid', 'profile']);
    });

    it('should handle empty scopes', () => {
      const user = mockUser({ scopes: [] });
      const result = service.getProfile(user);

      expect(result.scopes).toEqual([]);
    });
  });

  // ─── getMemberships ──────────────────────────────────

  describe('getMemberships', () => {
    it('should return mapped memberships with organization names', async () => {
      mockOrganizationMember.findMany.mockResolvedValue([
        mockMembership(),
        mockMembership({
          id: 'member-2',
          organizationId: 'org-2',
          role: 'ADMIN',
          organization: { id: 'org-2', name: 'Other Org', createdAt: NOW, updatedAt: NOW },
        }),
      ]);

      const result = await service.getMemberships('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'member-1',
        organizationId: 'org-1',
        organizationName: 'Test Org',
        role: 'MEMBER',
        joinedAt: NOW,
      });
      expect(result[1]).toEqual({
        id: 'member-2',
        organizationId: 'org-2',
        organizationName: 'Other Org',
        role: 'ADMIN',
        joinedAt: NOW,
      });
    });

    it('should return empty array when user has no memberships', async () => {
      mockOrganizationMember.findMany.mockResolvedValue([]);

      const result = await service.getMemberships('user-1');

      expect(result).toEqual([]);
    });

    it('should handle null organization name', async () => {
      mockOrganizationMember.findMany.mockResolvedValue([
        mockMembership({
          organization: { id: 'org-1', name: null, createdAt: NOW, updatedAt: NOW },
        }),
      ]);

      const result = await service.getMemberships('user-1');

      expect(result[0].organizationName).toBeNull();
    });

    it('should query with the correct userId and include organization', async () => {
      mockOrganizationMember.findMany.mockResolvedValue([]);

      await service.getMemberships('user-42');

      expect(mockOrganizationMember.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-42' },
        include: { organization: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
