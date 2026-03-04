import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import type { UserResponseDto } from './dto/user-response.dto';
import type { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import type { UserMembershipResponseDto } from './dto/user-membership-response.dto';
import type { KeycloakSessionResponseDto } from './dto/keycloak-session-response.dto';
import type { RevokeSessionsResponseDto } from './dto/revoke-sessions-response.dto';
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

  async getSessions(userId: string): Promise<KeycloakSessionResponseDto[]> {
    const sessions = await this.keycloakAdmin.getUserSessions(userId);

    return sessions.map((s) => ({
      id: s.id,
      username: s.username,
      ipAddress: s.ipAddress,
      startedAt: new Date(s.start * 1000).toISOString(),
      lastAccessedAt: new Date(s.lastAccess * 1000).toISOString(),
      clients: Object.entries(s.clients).map(([clientId, clientName]) => ({
        clientId,
        clientName,
      })),
      rememberMe: s.rememberMe,
    }));
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const sessions = await this.keycloakAdmin.getUserSessions(userId);
    const owned = sessions.some((s) => s.id === sessionId);

    if (!owned) {
      throw new NotFoundException('Session not found');
    }

    await this.keycloakAdmin.deleteSession(sessionId);
  }

  async revokeAllSessions(userId: string): Promise<RevokeSessionsResponseDto> {
    await this.keycloakAdmin.logoutAllSessions(userId);
    return { success: true, message: 'All sessions have been revoked' };
  }
}
