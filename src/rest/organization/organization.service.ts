import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { UserService } from '@/rest/user/user.service';
import type { PaginationParams } from '@/rest/common/pagination';
import { paginate, type PaginatedResult } from '@/rest/common/pagination';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
import type { OrganizationResponseDto } from './dto/organization-response.dto';
import type { OrganizationMemberResponseDto } from './dto/organization-member-response.dto';
import type { OrganizationMemberListItemDto } from './dto/organization-member-detail-response.dto';
import type { OrganizationMemberProfileResponseDto } from './dto/organization-member-detail-response.dto';
import type { OrganizationRole } from '@/generated/prisma/client';

@Injectable()
export class OrganizationService {
  constructor(private readonly userService: UserService) {}
  async create(dto: CreateOrganizationDto, userId: string): Promise<OrganizationResponseDto> {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.name },
      });

      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: org.id,
          role: 'ADMIN',
        },
      });

      return {
        id: org.id,
        name: org.name,
        memberCount: 1,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      };
    });
  }

  async findAll(pagination: PaginationParams): Promise<PaginatedResult<OrganizationResponseDto>> {
    return paginate(
      pagination,
      () => prisma.organization.count(),
      ({ skip, take }) =>
        prisma.organization
          .findMany({
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { members: true } } },
          })
          .then((orgs) =>
            orgs.map((org) => ({
              id: org.id,
              name: org.name,
              memberCount: org._count.members,
              createdAt: org.createdAt,
              updatedAt: org.updatedAt,
            }))
          )
    );
  }

  async findOne(id: string): Promise<OrganizationResponseDto> {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });

    if (!org) throw new NotFoundException('Organization not found');

    return {
      id: org.id,
      name: org.name,
      memberCount: org._count.members,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    userId: string
  ): Promise<OrganizationResponseDto> {
    await this.requireRole(id, userId, ['STAFF', 'ADMIN']);

    const org = await prisma.organization.update({
      where: { id },
      data: { ...(dto.name !== undefined && { name: dto.name }) },
      include: { _count: { select: { members: true } } },
    });

    return {
      id: org.id,
      name: org.name,
      memberCount: org._count.members,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.requireRole(id, userId, ['ADMIN']);

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    await prisma.organization.delete({ where: { id } });
  }

  async join(organizationId: string, userId: string): Promise<OrganizationMemberResponseDto> {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const existing = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (existing) throw new ConflictException('Already a member of this organization');

    return prisma.organizationMember.create({
      data: { userId, organizationId, role: 'MEMBER' },
    });
  }

  async leave(organizationId: string, userId: string): Promise<void> {
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership) throw new NotFoundException('Not a member of this organization');

    await prisma.organizationMember.delete({ where: { id: membership.id } });
  }

  async getMembers(
    organizationId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<OrganizationMemberListItemDto>> {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const where = { organizationId };

    return paginate(
      pagination,
      () => prisma.organizationMember.count({ where }),
      ({ skip, take }) =>
        prisma.organizationMember
          .findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, username: true, name: true, email: true } } },
          })
          .then((members) =>
            members.map((m) => ({
              userId: m.user.id,
              username: m.user.username,
              name: m.user.name,
              email: m.user.email,
              role: m.role,
              joinedAt: m.createdAt.toISOString(),
            }))
          )
    );
  }

  async getMemberProfile(
    organizationId: string,
    userId: string
  ): Promise<OrganizationMemberProfileResponseDto> {
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: { select: { id: true, username: true, name: true, email: true } } },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    const profile = await this.userService.getProfile(userId);

    return {
      userId: membership.user.id,
      username: membership.user.username,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      joinedAt: membership.createdAt.toISOString(),
      profile,
    };
  }

  private async requireRole(
    organizationId: string,
    userId: string,
    allowedRoles: OrganizationRole[]
  ): Promise<void> {
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires one of: ${allowedRoles.join(', ')}. You have: ${membership.role}`
      );
    }
  }
}
