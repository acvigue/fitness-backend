import { Injectable } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import type { UserResponseDto } from './dto/user-response.dto';
import type { UserMembershipResponseDto } from './dto/user-membership-response.dto';

@Injectable()
export class UserService {
  getProfile(user: AuthenticatedUser): UserResponseDto {
    return {
      sub: user.sub,
      username: user.username,
      name: user.name,
      email: user.email,
      scopes: user.scopes,
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
}
