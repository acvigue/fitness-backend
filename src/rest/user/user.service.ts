import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import type { UserResponseDto } from './dto/user-response.dto';
import type { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import type { UserMembershipResponseDto } from './dto/user-membership-response.dto';
import type { KeycloakSessionResponseDto } from './dto/keycloak-session-response.dto';
import type { RevokeSessionsResponseDto } from './dto/revoke-sessions-response.dto';
import type { UserLookupResponseDto } from './dto/user-lookup-response.dto';
import type { EnrichSessionResponseDto } from './dto/enrich-session.dto';
import { KeycloakAdminService } from './keycloak-admin.service';

@Injectable()
export class UserService {
  constructor(private readonly keycloakAdmin: KeycloakAdminService) {}
  async getOrCreateMe(user: AuthenticatedUser): Promise<UserResponseDto> {
    await prisma.user.upsert({
      where: { id: user.sub },
      update: { email: user.email, name: user.name, username: user.username },
      create: { id: user.sub, email: user.email, name: user.name, username: user.username },
    });

    await prisma.userProfile.upsert({
      where: { userId: user.sub },
      update: {},
      create: { userId: user.sub, bio: null, favoriteSports: [] },
    });

    return {
      sub: user.sub,
      username: user.username,
      name: user.name,
      email: user.email,
      scopes: user.scopes,
    };
  }

  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: { pictures: true },
    });

    if (!profile) {
      // Auto‑create profile if it doesn't exist (optional)
      return this.createProfile(userId);
    }

    return {
      userId: profile.userId,
      bio: profile.bio,
      favoriteSports: profile.favoriteSports,
      pictures: profile.pictures.map((p) => ({
        id: p.id,
        url: p.url,
        alt: p.alt ?? undefined,
        isPrimary: p.isPrimary,
      })),
    };
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto): Promise<UserProfileResponseDto> {
    // Ensure profile exists
    await prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const updated = await prisma.userProfile.update({
      where: { userId },
      data: {
        bio: dto.bio,
        favoriteSports: dto.favoriteSports,
      },
      include: { pictures: true },
    });

    return {
      userId: updated.userId,
      bio: updated.bio,
      favoriteSports: updated.favoriteSports,
      pictures: updated.pictures.map((p) => ({
        id: p.id,
        url: p.url,
        alt: p.alt ?? undefined,
        isPrimary: p.isPrimary,
      })),
    };
  }

  private async createProfile(userId: string): Promise<UserProfileResponseDto> {
    const profile = await prisma.userProfile.create({
      data: { userId },
      include: { pictures: true },
    });
    return {
      userId: profile.userId,
      bio: profile.bio,
      favoriteSports: profile.favoriteSports,
      pictures: [],
    };
  }

  async getMemberships(userId: string): Promise<UserMembershipResponseDto[]> {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  async getSessions(
    userId: string,
    currentSessionId?: string
  ): Promise<KeycloakSessionResponseDto[]> {
    const sessions = await this.keycloakAdmin.getUserSessions(userId);

    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const hasToken = s.offline ? await this.keycloakAdmin.hasRefreshToken(s.id) : false;
        return {
          id: s.id,
          username: s.username,
          ipAddress: s.ipAddress,
          startedAt: new Date(s.start).toISOString(),
          lastAccessedAt: new Date(s.lastAccess).toISOString(),
          clients: Object.entries(s.clients).map(([clientId, clientName]) => ({
            clientId,
            clientName,
          })),
          rememberMe: s.rememberMe,
          offline: s.offline,
          revocable: !s.offline || hasToken,
          thisSession: s.id === currentSessionId,
        };
      })
    );

    return enriched;
  }

  async enrichSession(sessionId: string, refreshToken: string): Promise<EnrichSessionResponseDto> {
    await this.keycloakAdmin.storeRefreshToken(sessionId, refreshToken);
    return { success: true, sessionId };
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const sessions = await this.keycloakAdmin.getUserSessions(userId);
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.offline) {
      await this.keycloakAdmin.revokeSessionByToken(sessionId);
    } else {
      await this.keycloakAdmin.deleteSession(sessionId);
    }
  }

  async revokeAllSessions(userId: string): Promise<RevokeSessionsResponseDto> {
    const sessions = await this.keycloakAdmin.getUserSessions(userId);
    await this.keycloakAdmin.logoutAllSessions(userId);

    // Blacklist all session IDs so in-flight access tokens are rejected
    await Promise.all(sessions.map((s) => this.keycloakAdmin.blacklistSession(s.id)));

    return { success: true, message: 'All sessions have been revoked' };
  }

  async lookupUsers(query: string, currentUserId: string): Promise<UserLookupResponseDto> {
    const searchTerm = query.trim();

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          {
            OR: [
              { email: { contains: searchTerm, mode: 'insensitive' } },
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { username: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, username: true, name: true, email: true },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        email: u.email,
      })),
    };
  }
}
