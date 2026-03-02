import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';

const mockUser = {
  upsert: vi.fn(),
};

const mockUserProfile = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const mockOrganizationMember = {
  findMany: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    user: mockUser,
    userProfile: mockUserProfile,
    organizationMember: mockOrganizationMember,
  },
  redis: {},
  redisSub: {},
}));

const { UserService } = await import('../user.service');

const NOW = new Date('2026-01-01T00:00:00Z');

function mockAuthUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
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

function mockProfile(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    bio: 'Hello world',
    favoriteSports: ['basketball', 'tennis'],
    pictures: [],
    createdAt: NOW,
    updatedAt: NOW,
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

  // ─── getOrCreateMe ────────────────────────────────────

  describe('getOrCreateMe', () => {
    it('should upsert user and profile, then return user info', async () => {
      mockUser.upsert.mockResolvedValue({});
      mockUserProfile.upsert.mockResolvedValue({});

      const user = mockAuthUser();
      const result = await service.getOrCreateMe(user);

      expect(result).toEqual({
        sub: 'user-1',
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        scopes: ['openid', 'profile'],
      });
    });

    it('should call prisma.user.upsert with correct data', async () => {
      mockUser.upsert.mockResolvedValue({});
      mockUserProfile.upsert.mockResolvedValue({});

      await service.getOrCreateMe(mockAuthUser());

      expect(mockUser.upsert).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        update: { email: 'test@example.com', name: 'Test User', username: 'testuser' },
        create: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          username: 'testuser',
        },
      });
    });

    it('should call prisma.userProfile.upsert to ensure profile exists', async () => {
      mockUser.upsert.mockResolvedValue({});
      mockUserProfile.upsert.mockResolvedValue({});

      await service.getOrCreateMe(mockAuthUser());

      expect(mockUserProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: {},
        create: { userId: 'user-1', bio: null, favoriteSports: [] },
      });
    });

    it('should handle optional fields being undefined', async () => {
      mockUser.upsert.mockResolvedValue({});
      mockUserProfile.upsert.mockResolvedValue({});

      const user = mockAuthUser({ username: undefined, name: undefined, email: undefined });
      const result = await service.getOrCreateMe(user);

      expect(result.sub).toBe('user-1');
      expect(result.username).toBeUndefined();
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();
    });
  });

  // ─── getProfile ────────────────────────────────────────

  describe('getProfile', () => {
    it('should return existing profile with pictures', async () => {
      mockUserProfile.findUnique.mockResolvedValue(
        mockProfile({
          pictures: [
            { id: 'pic-1', url: 'https://example.com/pic.jpg', alt: 'Photo', isPrimary: true },
          ],
        })
      );

      const result = await service.getProfile('user-1');

      expect(result).toEqual({
        userId: 'user-1',
        bio: 'Hello world',
        favoriteSports: ['basketball', 'tennis'],
        pictures: [
          { id: 'pic-1', url: 'https://example.com/pic.jpg', alt: 'Photo', isPrimary: true },
        ],
      });
    });

    it('should convert null alt to undefined in pictures', async () => {
      mockUserProfile.findUnique.mockResolvedValue(
        mockProfile({
          pictures: [
            { id: 'pic-1', url: 'https://example.com/pic.jpg', alt: null, isPrimary: false },
          ],
        })
      );

      const result = await service.getProfile('user-1');

      expect(result.pictures[0].alt).toBeUndefined();
    });

    it('should auto-create profile when it does not exist', async () => {
      mockUserProfile.findUnique.mockResolvedValue(null);
      mockUserProfile.create.mockResolvedValue(
        mockProfile({ bio: null, favoriteSports: [], pictures: [] })
      );

      const result = await service.getProfile('user-1');

      expect(mockUserProfile.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
        include: { pictures: true },
      });
      expect(result.userId).toBe('user-1');
      expect(result.pictures).toEqual([]);
    });

    it('should query with correct userId and include pictures', async () => {
      mockUserProfile.findUnique.mockResolvedValue(mockProfile());

      await service.getProfile('user-42');

      expect(mockUserProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-42' },
        include: { pictures: true },
      });
    });
  });

  // ─── updateProfile ────────────────────────────────────

  describe('updateProfile', () => {
    it('should ensure profile exists and update it', async () => {
      mockUserProfile.upsert.mockResolvedValue({});
      mockUserProfile.update.mockResolvedValue(
        mockProfile({ bio: 'Updated bio', favoriteSports: ['soccer'] })
      );

      const result = await service.updateProfile('user-1', {
        bio: 'Updated bio',
        favoriteSports: ['soccer'],
      });

      expect(result.bio).toBe('Updated bio');
      expect(result.favoriteSports).toEqual(['soccer']);
    });

    it('should upsert profile before updating to ensure it exists', async () => {
      mockUserProfile.upsert.mockResolvedValue({});
      mockUserProfile.update.mockResolvedValue(mockProfile());

      await service.updateProfile('user-1', { bio: 'test' });

      expect(mockUserProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: {},
        create: { userId: 'user-1' },
      });
    });

    it('should pass dto fields to prisma update', async () => {
      mockUserProfile.upsert.mockResolvedValue({});
      mockUserProfile.update.mockResolvedValue(mockProfile());

      await service.updateProfile('user-1', {
        bio: 'New bio',
        favoriteSports: ['running'],
      });

      expect(mockUserProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { bio: 'New bio', favoriteSports: ['running'] },
        include: { pictures: true },
      });
    });

    it('should map pictures with null alt to undefined', async () => {
      mockUserProfile.upsert.mockResolvedValue({});
      mockUserProfile.update.mockResolvedValue(
        mockProfile({
          pictures: [{ id: 'pic-1', url: 'https://example.com/1.jpg', alt: null, isPrimary: true }],
        })
      );

      const result = await service.updateProfile('user-1', { bio: 'test' });

      expect(result.pictures[0].alt).toBeUndefined();
    });
  });

  // ─── getMemberships ────────────────────────────────────

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
