import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import type { DeactivateAccountResponseDto } from './dto/deactivate-account-response.dto';
import type { DeleteAccountResponseDto } from './dto/delete-account-response.dto';
import { KeycloakAdminService } from './keycloak-admin.service';

@Injectable()
export class UserService {
  constructor(private readonly keycloakAdmin: KeycloakAdminService) {}
  async getOrCreateMe(user: AuthenticatedUser): Promise<UserResponseDto> {
    const existing = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { active: true },
    });

    await prisma.user.upsert({
      where: { id: user.sub },
      update: { email: user.email, name: user.name, username: user.username, active: true },
      create: { id: user.sub, email: user.email, name: user.name, username: user.username },
    });

    if (existing && !existing.active) {
      await this.keycloakAdmin.enableUser(user.sub);
    }

    await prisma.userProfile.upsert({
      where: { userId: user.sub },
      update: {},
      create: { userId: user.sub, bio: null },
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
      include: {
        pictures: true,
        favoriteSports: true,
        featuredAchievements: { include: { achievement: true } },
      },
    });

    if (!profile) {
      return this.createProfile(userId);
    }

    return this.toProfileResponse(profile);
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto): Promise<UserProfileResponseDto> {
    // Ensure profile exists
    await prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const data: Record<string, unknown> = {};
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.favoriteSportIds !== undefined) {
      data.favoriteSports = {
        set: dto.favoriteSportIds.map((id) => ({ id })),
      };
    }

    if (dto.pictureIds !== undefined) {
      const uniqueIds = [...new Set(dto.pictureIds)];

      // Resolve IDs from both media and existing profile pictures
      const [media, existingPictures] = await Promise.all([
        prisma.media.findMany({ where: { id: { in: uniqueIds }, userId } }),
        prisma.userProfilePicture.findMany({ where: { id: { in: uniqueIds }, userId } }),
      ]);

      const resolvedUrls = new Map<string, string>();
      for (const m of media) resolvedUrls.set(m.id, m.url);
      for (const p of existingPictures) resolvedUrls.set(p.id, p.url);

      const unresolved = uniqueIds.filter((id) => !resolvedUrls.has(id));
      if (unresolved.length > 0) {
        throw new BadRequestException(
          'One or more picture IDs are invalid or do not belong to you'
        );
      }

      await prisma.userProfilePicture.deleteMany({ where: { userId } });
      await prisma.userProfilePicture.createMany({
        data: dto.pictureIds.map((id, index) => ({
          userId,
          url: resolvedUrls.get(id) as string,
          isPrimary: index === 0,
        })),
      });
    }

    if (dto.featuredAchievementIds !== undefined) {
      const uniqueIds = [...new Set(dto.featuredAchievementIds)];
      const userAchievements = await prisma.userAchievement.findMany({
        where: { id: { in: uniqueIds }, userId, unlockedAt: { not: null } },
      });

      if (userAchievements.length !== uniqueIds.length) {
        throw new BadRequestException(
          'One or more achievement IDs are invalid, not yours, or not yet unlocked'
        );
      }

      data.featuredAchievements = {
        set: uniqueIds.map((id) => ({ id })),
      };
    }

    const updated = await prisma.userProfile.update({
      where: { userId },
      data,
      include: {
        pictures: true,
        favoriteSports: true,
        featuredAchievements: { include: { achievement: true } },
      },
    });

    return this.toProfileResponse(updated);
  }

  private async createProfile(userId: string): Promise<UserProfileResponseDto> {
    const profile = await prisma.userProfile.create({
      data: { userId },
      include: {
        pictures: true,
        favoriteSports: true,
        featuredAchievements: { include: { achievement: true } },
      },
    });
    return this.toProfileResponse(profile);
  }

  private toProfileResponse(profile: {
    userId: string;
    bio: string | null;
    favoriteSports: { id: string; name: string; icon: string | null }[];
    pictures: { id: string; url: string; alt: string | null; isPrimary: boolean }[];
    featuredAchievements: {
      id: string;
      progress: number;
      unlockedAt: Date | null;
      achievement: {
        id: string;
        name: string;
        description: string;
        icon: string | null;
        criteriaType: string;
        threshold: number;
      };
    }[];
  }): UserProfileResponseDto {
    return {
      userId: profile.userId,
      bio: profile.bio,
      favoriteSports: profile.favoriteSports.map((s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
      })),
      pictures: profile.pictures.map((p) => ({
        id: p.id,
        url: p.url,
        alt: p.alt ?? undefined,
        isPrimary: p.isPrimary,
      })),
      featuredAchievements: profile.featuredAchievements.map((ua) => ({
        id: ua.id,
        progress: ua.progress,
        unlockedAt: ua.unlockedAt?.toISOString() ?? null,
        achievement: {
          id: ua.achievement.id,
          name: ua.achievement.name,
          description: ua.achievement.description,
          icon: ua.achievement.icon,
          criteriaType: ua.achievement.criteriaType,
          threshold: ua.achievement.threshold,
        },
      })),
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
          { active: true },
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

  async deactivateAccount(userId: string): Promise<DeactivateAccountResponseDto> {
    await prisma.user.update({
      where: { id: userId },
      data: { active: false },
    });

    await this.keycloakAdmin.disableUser(userId);
    await this.keycloakAdmin.logoutAllSessions(userId);

    return { success: true, message: 'Account has been deactivated' };
  }

  async deleteAccount(userId: string): Promise<DeleteAccountResponseDto> {
    await prisma.user.delete({ where: { id: userId } });
    await this.keycloakAdmin.deleteUser(userId);

    return { success: true, message: 'Account has been permanently deleted' };
  }
}
