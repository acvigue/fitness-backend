import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { UserBlockService } from '@/rest/user-block/user-block.service';
import { EngagementService } from '@/rest/engagement/engagement.service';
import { EngagementType } from '@/generated/prisma/enums';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import type { UserResponseDto } from './dto/user-response.dto';
import type { UpdateNameDto } from './dto/update-name.dto';
import type { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import type { UserMembershipResponseDto } from './dto/user-membership-response.dto';
import type { ProfileComparisonResponseDto } from './dto/profile-comparison-response.dto';
import type { KeycloakSessionResponseDto } from './dto/keycloak-session-response.dto';
import type { RevokeSessionsResponseDto } from './dto/revoke-sessions-response.dto';
import type { UserLookupResponseDto } from './dto/user-lookup-response.dto';
import type { EnrichSessionResponseDto } from './dto/enrich-session.dto';
import type { DeactivateAccountResponseDto } from './dto/deactivate-account-response.dto';
import type { DeleteAccountResponseDto } from './dto/delete-account-response.dto';
import { KeycloakAdminService } from './keycloak-admin.service';
import type { TournamentResponseDto } from '~/rest/tournament/dto/tournament-response.dto';
import { UpdateUserProfilePrivacyDto } from '~/rest/user/dto/update-user-profile-privacy.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly userBlockService: UserBlockService,
    private readonly engagementService: EngagementService
  ) {}
  async getOrCreateMe(user: AuthenticatedUser): Promise<UserResponseDto> {
    const existing = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { active: true },
    });

    await prisma.user.upsert({
      where: { id: user.sub },
      update: {
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        active: true,
      },
      create: {
        id: user.sub,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
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
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      scopes: user.scopes,
    };
  }

  async getProfile(userId: string, viewerId?: string): Promise<UserProfileResponseDto> {
    if (viewerId && viewerId !== userId) {
      if (await this.userBlockService.didBlock(userId, viewerId)) {
        throw new ForbiddenException('You are not allowed to view this profile');
      }
      this.engagementService
        .recordEvent({
          userId: viewerId,
          type: EngagementType.PROFILE_VIEW,
          targetUserId: userId,
        })
        .catch(() => undefined);
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        pictures: true,
        tournaments: { include: { users: true, teams: true, sport: true } },
        favoriteSports: true,
        featuredAchievements: { include: { achievement: true } },
      },
    });
    if (!profile) {
      return this.createProfile(userId);
    }

    const response = this.toProfileResponse(profile);
    return this.applyPrivacy(response, profile, viewerId);
  }

  private applyPrivacy(
    response: UserProfileResponseDto,
    profile: {
      userId: string;
      privateBio: boolean;
      privateSports: boolean;
      privateTournaments: boolean;
      privateAchievements: boolean;
    },
    viewerId?: string
  ): UserProfileResponseDto {
    if (viewerId === undefined || viewerId === profile.userId) {
      return response;
    }
    return {
      ...response,
      bio: profile.privateBio ? null : response.bio,
      favoriteSports: profile.privateSports ? [] : response.favoriteSports,
      tournaments: profile.privateTournaments ? [] : response.tournaments,
      featuredAchievements: profile.privateAchievements ? [] : response.featuredAchievements,
    };
  }

  async compareProfiles(
    aId: string,
    bId: string,
    viewerId: string
  ): Promise<ProfileComparisonResponseDto> {
    const [profileA, profileB] = await Promise.all([
      this.getProfile(aId, viewerId),
      this.getProfile(bId, viewerId),
    ]);

    const [achievementCountA, achievementCountB] = await Promise.all([
      prisma.userAchievement.count({ where: { userId: aId, unlockedAt: { not: null } } }),
      prisma.userAchievement.count({ where: { userId: bId, unlockedAt: { not: null } } }),
    ]);

    return {
      a: {
        profile: profileA,
        stats: {
          tournamentCount: profileA.tournaments.length,
          achievementCount: achievementCountA,
          featuredAchievementCount: profileA.featuredAchievements.length,
          favoriteSportsCount: profileA.favoriteSports.length,
        },
      },
      b: {
        profile: profileB,
        stats: {
          tournamentCount: profileB.tournaments.length,
          achievementCount: achievementCountB,
          featuredAchievementCount: profileB.featuredAchievements.length,
          favoriteSportsCount: profileB.favoriteSports.length,
        },
      },
    };
  }

  async getPrivacy(userId: string): Promise<UpdateUserProfilePrivacyDto> {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException();
    }
    return {
      privateBio: profile.privateBio,
      privateSports: profile.privateSports,
      privateTournaments: profile.privateTournaments,
      privateAchievements: profile.privateAchievements,
    };
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
        user: { select: { firstName: true, lastName: true } },
        pictures: true,
        favoriteSports: true,
        tournaments: { include: { users: true, teams: true, sport: true } },
        featuredAchievements: { include: { achievement: true } },
      },
    });

    return this.toProfileResponse(updated);
  }

  async updatePrivacy(
    userId: string,
    dto: UpdateUserProfilePrivacyDto
  ): Promise<UpdateUserProfilePrivacyDto> {
    const data = await prisma.userProfile.update({
      where: { userId: userId },
      data: {
        privateBio: dto.privateBio,
        privateSports: dto.privateSports,
        privateTournaments: dto.privateTournaments,
        privateAchievements: dto.privateAchievements,
      },
    });
    return {
      privateBio: data.privateBio,
      privateSports: data.privateSports,
      privateTournaments: data.privateTournaments,
      privateAchievements: data.privateAchievements,
    };
  }

  private async createProfile(userId: string): Promise<UserProfileResponseDto> {
    const profile = await prisma.userProfile.create({
      data: { userId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        pictures: true,
        favoriteSports: true,
        tournaments: { include: { users: true, teams: true, sport: true } },
        featuredAchievements: { include: { achievement: true } },
      },
    });
    return this.toProfileResponse(profile);
  }

  private toProfileResponse(profile: {
    userId: string;
    user: { firstName: string | null; lastName: string | null };
    bio: string | null;
    favoriteSports: { id: string; name: string; icon: string | null }[];
    tournaments: {
      id: string;
      name: string;
      format: string;
      status: string;
      maxTeams: number;
      organizationId: string;
      createdById: string;
      startDate: Date;
      createdAt: Date;
      sport: { id: string; name: string; icon: string | null };
      users: { id: string; username: string | null; name: string | null; email: string | null }[];
      teams: { id: string; name: string; captainId: string }[];
    }[];
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
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      bio: profile.bio,
      favoriteSports: profile.favoriteSports.map((s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
      })),
      tournaments: profile.tournaments.map((tournament) => ({
        id: tournament.id,
        name: tournament.name,
        format: tournament.format as TournamentResponseDto['format'],
        status: tournament.status as TournamentResponseDto['status'],
        maxTeams: tournament.maxTeams,
        organizationId: tournament.organizationId,
        createdById: tournament.createdById,
        startDate: tournament.startDate.toISOString(),
        createdAt: tournament.createdAt.toISOString(),
        sport: {
          id: tournament.sport.id,
          name: tournament.sport.name,
          icon: tournament.sport.icon,
        },
        participants: tournament.users.map((u) => ({
          sub: u.id,
          username: u.username ?? undefined,
          name: u.name ?? undefined,
          email: u.email ?? undefined,
          scopes: [],
        })),
        teams: tournament.teams.map((t) => ({
          id: t.id,
          name: t.name,
          captainId: t.captainId,
        })),
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

  async updateName(userId: string, dto: UpdateNameDto): Promise<UserResponseDto> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        name: `${dto.firstName} ${dto.lastName}`.trim() || null,
      },
      select: {
        id: true,
        username: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    return {
      sub: user.id,
      username: user.username ?? undefined,
      name: user.name ?? undefined,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      email: user.email ?? undefined,
      scopes: [],
    };
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
              { firstName: { contains: searchTerm, mode: 'insensitive' } },
              { lastName: { contains: searchTerm, mode: 'insensitive' } },
              { username: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        firstName: u.firstName,
        lastName: u.lastName,
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
