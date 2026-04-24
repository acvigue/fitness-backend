import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { TeamBlockService } from '@/rest/team-block/team-block.service';
import { NotificationService } from '@/rest/notification/notification.service';
import { EngagementService } from '@/rest/engagement/engagement.service';
import { EngagementType } from '@/generated/prisma/enums';
import type { CreateMeetupDto } from './dto/create-meetup.dto';
import type { MeetupResponseDto } from './dto/meetup-response.dto';

@Injectable()
export class MeetupService {
  constructor(
    private readonly teamBlockService: TeamBlockService,
    private readonly notificationService: NotificationService,
    private readonly engagementService: EngagementService
  ) {}

  async proposeMeetup(dto: CreateMeetupDto, userId: string): Promise<MeetupResponseDto> {
    if (dto.proposingTeamId === dto.receivingTeamId) {
      throw new BadRequestException('Cannot propose a meetup with your own team');
    }

    const proposingTeam = await prisma.team.findUnique({
      where: { id: dto.proposingTeamId },
      include: { users: { select: { id: true } } },
    });
    if (!proposingTeam) throw new NotFoundException('Proposing team not found');

    if (!proposingTeam.users.some((u) => u.id === userId)) {
      throw new ForbiddenException('You are not a member of the proposing team');
    }

    const receivingTeam = await prisma.team.findUnique({
      where: { id: dto.receivingTeamId },
    });
    if (!receivingTeam) throw new NotFoundException('Receiving team not found');

    const blocked = await this.teamBlockService.isBlocked(dto.proposingTeamId, dto.receivingTeamId);
    if (blocked) {
      throw new ForbiddenException('Cannot propose a meetup with a blocked team');
    }

    const meetup = await prisma.meetup.create({
      data: {
        proposingTeamId: dto.proposingTeamId,
        receivingTeamId: dto.receivingTeamId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        dateTime: new Date(dto.dateTime),
      },
      include: {
        proposingTeam: { select: { name: true } },
        receivingTeam: { select: { name: true, captainId: true } },
      },
    });

    // Notify receiving team captain
    await this.notificationService.create(
      meetup.receivingTeam.captainId,
      'MEETUP_PROPOSAL',
      'New Meetup Proposal',
      `"${meetup.title}" proposed by ${meetup.proposingTeam.name}`
    );

    return this.toResponse(meetup);
  }

  async acceptMeetup(meetupId: string, userId: string): Promise<MeetupResponseDto> {
    const meetup = await this.findMeetupOrThrow(meetupId);

    if (meetup.status !== 'PENDING') {
      throw new BadRequestException('Only pending meetups can be accepted');
    }

    if (meetup.receivingTeam.captainId !== userId) {
      throw new ForbiddenException('Only the receiving team captain can accept meetups');
    }

    const updated = await prisma.meetup.update({
      where: { id: meetupId },
      data: { status: 'ACCEPTED' },
      include: {
        proposingTeam: { select: { name: true, captainId: true, users: { select: { id: true } } } },
        receivingTeam: { select: { name: true, captainId: true, users: { select: { id: true } } } },
      },
    });

    // Notify all members of both teams
    const allMembers = [
      ...updated.proposingTeam.users.map((u) => u.id),
      ...updated.receivingTeam.users.map((u) => u.id),
    ];

    for (const memberId of allMembers) {
      if (memberId !== userId) {
        await this.notificationService.create(
          memberId,
          'MEETUP_ACCEPTED',
          'Meetup Accepted',
          `"${updated.title}" with ${updated.proposingTeam.name} & ${updated.receivingTeam.name} has been confirmed`
        );
      }
      this.engagementService
        .recordEvent({
          userId: memberId,
          type: EngagementType.MEETUP_ATTENDED,
          metadata: { meetupId: updated.id },
        })
        .catch(() => undefined);
    }

    return this.toResponse(updated);
  }

  async declineMeetup(meetupId: string, userId: string): Promise<MeetupResponseDto> {
    const meetup = await this.findMeetupOrThrow(meetupId);

    if (meetup.status !== 'PENDING') {
      throw new BadRequestException('Only pending meetups can be declined');
    }

    if (meetup.receivingTeam.captainId !== userId) {
      throw new ForbiddenException('Only the receiving team captain can decline meetups');
    }

    const updated = await prisma.meetup.update({
      where: { id: meetupId },
      data: { status: 'DECLINED' },
      include: {
        proposingTeam: { select: { name: true, captainId: true } },
        receivingTeam: { select: { name: true, captainId: true } },
      },
    });

    // Notify proposing team captain
    await this.notificationService.create(
      updated.proposingTeam.captainId,
      'MEETUP_DECLINED',
      'Meetup Declined',
      `"${updated.title}" with ${updated.receivingTeam.name} was declined`
    );

    return this.toResponse(updated);
  }

  async cancelMeetup(meetupId: string, userId: string): Promise<MeetupResponseDto> {
    const meetup = await this.findMeetupOrThrow(meetupId);

    if (meetup.status !== 'PENDING' && meetup.status !== 'ACCEPTED') {
      throw new BadRequestException('Only pending or accepted meetups can be cancelled');
    }

    if (meetup.proposingTeam.captainId !== userId) {
      throw new ForbiddenException('Only the proposing team captain can cancel meetups');
    }

    const updated = await prisma.meetup.update({
      where: { id: meetupId },
      data: { status: 'CANCELLED' },
      include: {
        proposingTeam: { select: { name: true, captainId: true } },
        receivingTeam: { select: { name: true, captainId: true } },
      },
    });

    // Notify receiving team captain
    await this.notificationService.create(
      updated.receivingTeam.captainId,
      'MEETUP_CANCELLED',
      'Meetup Cancelled',
      `"${updated.title}" with ${updated.proposingTeam.name} was cancelled`
    );

    return this.toResponse(updated);
  }

  async getTeamMeetups(teamId: string, userId: string): Promise<MeetupResponseDto[]> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { users: { select: { id: true } } },
    });
    if (!team) throw new NotFoundException('Team not found');

    if (!team.users.some((u) => u.id === userId)) {
      throw new ForbiddenException('You are not a member of this team');
    }

    const meetups = await prisma.meetup.findMany({
      where: {
        OR: [{ proposingTeamId: teamId }, { receivingTeamId: teamId }],
      },
      include: {
        proposingTeam: { select: { name: true, captainId: true } },
        receivingTeam: { select: { name: true, captainId: true } },
      },
      orderBy: { dateTime: 'asc' },
    });

    return meetups.map((m) => this.toResponse(m));
  }

  async getMeetup(meetupId: string, userId: string): Promise<MeetupResponseDto> {
    const meetup = await this.findMeetupOrThrow(meetupId);

    // Verify user is member of either team
    const isMember = await prisma.team.findFirst({
      where: {
        id: { in: [meetup.proposingTeamId, meetup.receivingTeamId] },
        users: { some: { id: userId } },
      },
      select: { id: true },
    });

    if (!isMember) {
      throw new ForbiddenException('You are not a member of either team');
    }

    return this.toResponse(meetup);
  }

  private async findMeetupOrThrow(meetupId: string) {
    const meetup = await prisma.meetup.findUnique({
      where: { id: meetupId },
      include: {
        proposingTeam: { select: { name: true, captainId: true, users: { select: { id: true } } } },
        receivingTeam: { select: { name: true, captainId: true, users: { select: { id: true } } } },
      },
    });

    if (!meetup) throw new NotFoundException('Meetup not found');

    return meetup;
  }

  private toResponse(meetup: {
    id: string;
    proposingTeamId: string;
    proposingTeam: { name: string };
    receivingTeamId: string;
    receivingTeam: { name: string };
    title: string;
    description: string | null;
    location: string;
    dateTime: Date;
    status: string;
    createdAt: Date;
  }): MeetupResponseDto {
    return {
      id: meetup.id,
      proposingTeamId: meetup.proposingTeamId,
      proposingTeamName: meetup.proposingTeam.name,
      receivingTeamId: meetup.receivingTeamId,
      receivingTeamName: meetup.receivingTeam.name,
      title: meetup.title,
      description: meetup.description,
      location: meetup.location,
      dateTime: meetup.dateTime.toISOString(),
      status: meetup.status,
      createdAt: meetup.createdAt.toISOString(),
    };
  }
}
