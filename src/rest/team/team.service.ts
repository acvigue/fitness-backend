import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import { UserService } from '@/rest/user/user.service';
import type { TeamCreateDto } from './dto/team-create.dto';
import type { TeamResponseDto } from './dto/team-response.dto';
import type { TeamUpdateCaptainDto } from './dto/team-update-captain.dto';
import type { TeamUpdateDto } from './dto/team-update.dto';
import type { TeamInvitationResponseDto } from './dto/team-invitation-response.dto';
import type { TeamMemberProfileResponseDto } from './dto/team-member-profile-response.dto';

const TEAM_INCLUDE = {
  users: { select: { id: true, username: true, name: true, email: true } },
} as const;

@Injectable()
export class TeamService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly userService: UserService
  ) {}

  async create(dto: TeamCreateDto, userId: string): Promise<TeamResponseDto> {
    const team = await prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description ?? '',
        captainId: userId,
        sportId: dto.sportId,
        users: {
          connect: [{ id: userId }],
        },
      },
    });

    return this.toResponse(team);
  }

  async findAll(): Promise<TeamResponseDto[]> {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' },
	  include: { users: { select: { id: true } } },
    });

    return teams.map((team) => this.toResponse(team));
  }

  async findOne(id: string): Promise<TeamResponseDto> {
    const team = await prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return this.toResponse(team);
  }

  async update(id: string, dto: TeamUpdateDto, userId: string): Promise<TeamResponseDto> {
    const team = await prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== userId) {
      throw new ForbiddenException('You are not the current team captain');
    }

    const updatedTeam = await prisma.team.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description ?? '',
        sportId: dto.sportId,
      },
	  include: TOURNAMENT_INCLUDE,
    });

    return this.toResponse(updatedTeam);
  }

  async updateCaptain(
    id: string,
    dto: TeamUpdateCaptainDto,
    userId: string
  ): Promise<TeamResponseDto> {
    const team = await prisma.team.findUnique({
      where: { id },
	  include: TOURNAMENT_INCLUDE,
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== userId) {
      throw new ForbiddenException('You are not the current team captain');
    }

    const updatedTeam = await prisma.team.update({
      where: { id },
      data: {
        captainId: dto.captainId,
      },
	  include: TOURNAMENT_INCLUDE,
    });

    await this.notificationService.create(
      dto.captainId,
      'CAPTAIN_ASSIGNED',
      'Captain Role Assigned',
      `You have been assigned as captain of team "${team.name}"`
    );

    await this.notificationService.create(
      userId,
      'CAPTAIN_TRANSFERRED',
      'Captain Role Transferred',
      `You have transferred captaincy of team "${team.name}"`
    );

    return this.toResponse(updatedTeam);
  }

  async delete(id: string, userId: string): Promise<void> {
    const team = await prisma.team.findUnique({
      where: { id },
      include: { users: { select: { id: true } } },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== userId) {
      throw new ForbiddenException('You are not the current team captain');
    }

    await prisma.team.delete({
      where: { id },
    });

    for (const member of team.users) {
      if (member.id !== userId) {
        await this.notificationService.create(
          member.id,
          'TEAM_DELETED',
          'Team Disbanded',
          `Team "${team.name}" has been disbanded`
        );
      }
    }
  }

  // ─── Members ────────────────────────────────────────────

  async leaveTeam(teamId: string, userId: string): Promise<void> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { users: { select: { id: true } } },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isMember = team.users.some((u) => u.id === userId);
    if (!isMember) {
      throw new BadRequestException('You are not a member of this team');
    }

    if (team.captainId === userId) {
      throw new BadRequestException('Captain cannot leave the team. Transfer captaincy first.');
    }

    await prisma.team.update({
      where: { id: teamId },
      data: { users: { disconnect: { id: userId } } },
    });

    await this.notificationService.create(
      team.captainId,
      'MEMBER_LEFT',
      'Member Left Team',
      `A member has left team "${team.name}"`
    );
  }

  async removeMember(teamId: string, targetUserId: string, userId: string): Promise<void> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { users: { select: { id: true } } },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can remove members');
    }

    if (targetUserId === userId) {
      throw new BadRequestException('Captain cannot remove themselves');
    }

    const isMember = team.users.some((u) => u.id === targetUserId);
    if (!isMember) {
      throw new BadRequestException('User is not a member of this team');
    }

    await prisma.team.update({
      where: { id: teamId },
      data: { users: { disconnect: { id: targetUserId } } },
    });

    await this.notificationService.create(
      targetUserId,
      'REMOVED_FROM_TEAM',
      'Removed from Team',
      `You have been removed from team "${team.name}"`
    );
  }

  // ─── Invitations ───────────────────────────────────────

  async sendInvitation(
    teamId: string,
    targetUserId: string,
    userId: string
  ): Promise<TeamInvitationResponseDto> {
    const team = await prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can send invitations');
    }

    const existing = await prisma.teamInvitation.findFirst({
      where: { teamId, userId: targetUserId, type: 'INVITE', status: 'PENDING' },
    });

    if (existing) {
      throw new BadRequestException('An invitation is already pending for this user');
    }

    const invitation = await prisma.teamInvitation.create({
      data: { teamId, userId: targetUserId, type: 'INVITE' },
    });

    await this.notificationService.create(
      targetUserId,
      'TEAM_INVITE',
      'Team Invitation',
      `You have been invited to join team "${team.name}"`
    );

    return this.toInvitationResponse(invitation);
  }

  async requestToJoin(teamId: string, userId: string): Promise<TeamInvitationResponseDto> {
    const team = await prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const existing = await prisma.teamInvitation.findFirst({
      where: { teamId, userId, type: 'REQUEST', status: 'PENDING' },
    });

    if (existing) {
      throw new BadRequestException('You already have a pending request for this team');
    }

    const invitation = await prisma.teamInvitation.create({
      data: { teamId, userId, type: 'REQUEST' },
    });

    await this.notificationService.create(
      team.captainId,
      'TEAM_JOIN_REQUEST',
      'Join Request',
      `A user has requested to join team "${team.name}"`
    );

    return this.toInvitationResponse(invitation);
  }

  async respondToInvitation(
    invitationId: string,
    userId: string,
    accept: boolean
  ): Promise<TeamInvitationResponseDto> {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('This invitation has already been responded to');
    }

    // For INVITE type, the invited user responds
    // For REQUEST type, the team captain responds
    if (invitation.type === 'INVITE' && invitation.userId !== userId) {
      throw new ForbiddenException('Only the invited user can respond to this invitation');
    }

    if (invitation.type === 'REQUEST' && invitation.team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can respond to join requests');
    }

    const status = accept ? 'ACCEPTED' : 'DECLINED';

    const updated = await prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status },
    });

    if (accept) {
      await prisma.team.update({
        where: { id: invitation.teamId },
        data: { users: { connect: { id: invitation.userId } } },
      });
    }

    // Notify the other party
    if (invitation.type === 'INVITE') {
      await this.notificationService.create(
        invitation.team.captainId,
        'TEAM_INVITE_RESPONSE',
        accept ? 'Invitation Accepted' : 'Invitation Declined',
        accept
          ? `Your invitation to join team "${invitation.team.name}" was accepted`
          : `Your invitation to join team "${invitation.team.name}" was declined`
      );
    } else {
      await this.notificationService.create(
        invitation.userId,
        'TEAM_REQUEST_RESPONSE',
        accept ? 'Join Request Approved' : 'Join Request Declined',
        accept
          ? `Your request to join team "${invitation.team.name}" was approved`
          : `Your request to join team "${invitation.team.name}" was declined`
      );
    }

    return this.toInvitationResponse(updated);
  }

  async getTeamInvitations(teamId: string, userId: string): Promise<TeamInvitationResponseDto[]> {
    const team = await prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can view team invitations');
    }

    const invitations = await prisma.teamInvitation.findMany({
      where: { teamId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => this.toInvitationResponse(inv));
  }

  async getUserInvitations(userId: string): Promise<TeamInvitationResponseDto[]> {
    const invitations = await prisma.teamInvitation.findMany({
      where: { userId, type: 'INVITE', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => this.toInvitationResponse(inv));
  }

  async cancelInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can cancel invitations');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Only pending invitations can be cancelled');
    }

    await prisma.teamInvitation.delete({ where: { id: invitationId } });
  }

  // ─── Member Profile ────────────────────────────────────

  async getMemberProfile(teamId: string, userId: string): Promise<TeamMemberProfileResponseDto> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { users: { select: { id: true } } },
    });

    if (!team) throw new NotFoundException('Team not found');

    const isMember = team.users.some((u) => u.id === userId);
    if (!isMember) throw new NotFoundException('User is not a member of this team');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, email: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const profile = await this.userService.getProfile(userId);

    return {
      userId: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      isCaptain: team.captainId === userId,
      profile,
    };
  }

  // ─── Helpers ───────────────────────────────────────────

  private toResponse(team: {
    id: string;
    name: string;
    description: string;
    captainId: string;
    sportId: string;
	users: { id: string; username: string | null; name: string | null; email: string | null }[];
  }): TeamResponseDto {
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      captainId: team.captainId,
      sportId: team.sportId,
	  members: team.users.map((u) => ({
        sub: u.id,
        username: u.username ?? undefined,
        name: u.name ?? undefined,
        email: u.email ?? undefined,
        scopes: [],
	  })),
    };
  }

  private toInvitationResponse(invitation: {
    id: string;
    teamId: string;
    userId: string;
    type: string;
    status: string;
    createdAt: Date;
  }): TeamInvitationResponseDto {
    return {
      id: invitation.id,
      teamId: invitation.teamId,
      userId: invitation.userId,
      type: invitation.type,
      status: invitation.status,
      createdAt: invitation.createdAt.toISOString(),
    };
  }
}
