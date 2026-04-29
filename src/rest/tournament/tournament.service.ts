import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import { AchievementService } from '@/rest/achievement/achievement.service';
import { ModerationService } from '@/rest/moderation/moderation.service';
import type { PaginationParams } from '@/rest/common/pagination';
import { paginate, type PaginatedResult } from '@/rest/common/pagination';
import type { CreateTournamentDto } from './dto/create-tournament.dto';
import type { UpdateTournamentDto } from './dto/update-tournament.dto';
import type { RecordMatchResultDto } from './dto/record-match-result.dto';
import type { TournamentResponseDto } from './dto/tournament-response.dto';
import type { TournamentInvitationResponseDto } from './dto/tournament-invitation-response.dto';
import type { TournamentBracketResponseDto } from './dto/tournament-bracket-response.dto';
import type { TournamentMatchResponseDto } from './dto/tournament-match-response.dto';
import type { TournamentStandingsResponseDto } from './dto/tournament-standings-response.dto';
import type { Prisma } from '@/generated/prisma/client';
import type { TournamentStatus } from '@/generated/prisma/enums';
import { type VideoResponseDto, type VideoStatusValue } from '@/rest/video/dto/video-response.dto';
import { MuxService } from '@/rest/video/mux.service';

function videoToResponse(video: Prisma.VideoGetPayload<object>): VideoResponseDto {
  const playbackId = video.muxPlaybackId;
  return {
    id: video.id,
    name: video.name,
    description: video.description,
    uploaderId: video.uploaderId,
    sportId: video.sportId,
    status: video.status as VideoStatusValue,
    playbackUrl: playbackId ? MuxService.playbackUrl(playbackId) : null,
    thumbnailUrl: playbackId ? MuxService.thumbnailUrl(playbackId) : null,
    durationSec: video.durationSec,
    aspectRatio: video.aspectRatio,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  };
}

const TOURNAMENT_INCLUDE = {
  sport: true,
  users: { select: { id: true, username: true, name: true, email: true } },
  teams: { select: { id: true, name: true, captainId: true } },
} as const;

function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function roundLabel(round: number, totalRounds: number): string {
  const remaining = totalRounds - round;
  if (remaining === 0) return 'Final';
  if (remaining === 1) return 'Semifinals';
  if (remaining === 2) return 'Quarterfinals';
  return `Round ${round}`;
}

const MATCH_INCLUDE = {
  team1: { select: { id: true, name: true, captainId: true } },
  team2: { select: { id: true, name: true, captainId: true } },
  winner: { select: { id: true, name: true, captainId: true } },
} as const;

function toResponse(tournament: {
  id: string;
  name: string;
  format: string;
  status: string;
  maxTeams: number;
  organizationId: string;
  createdById: string;
  startDate: Date;
  registrationClosesAt: Date | null;
  createdAt: Date;
  sport: { id: string; name: string; icon: string | null };
  users: { id: string; username: string | null; name: string | null; email: string | null }[];
  teams: { id: string; name: string; captainId: string }[];
}): TournamentResponseDto {
  return {
    id: tournament.id,
    name: tournament.name,
    format: tournament.format as TournamentResponseDto['format'],
    status: tournament.status as TournamentResponseDto['status'],
    maxTeams: tournament.maxTeams,
    organizationId: tournament.organizationId,
    createdById: tournament.createdById,
    startDate: tournament.startDate.toISOString(),
    registrationClosesAt: tournament.registrationClosesAt?.toISOString() ?? null,
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
  };
}

@Injectable()
export class TournamentService {
  private readonly logger = new Logger(TournamentService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly achievementService: AchievementService,
    private readonly moderationService: ModerationService
  ) {}

  async create(dto: CreateTournamentDto, userId: string): Promise<TournamentResponseDto> {
    const format = dto.format ?? 'SINGLE_ELIMINATION';

    if (format === 'SINGLE_ELIMINATION' && !isPowerOfTwo(dto.maxTeams)) {
      throw new BadRequestException('maxTeams must be a power of 2 (e.g. 2, 4, 8, 16, 32)');
    }

    await this.requireOrgManager(dto.organizationId, userId);

    const tournament = await prisma.tournament.create({
      data: {
        name: dto.name,
        sportId: dto.sportId,
        organizationId: dto.organizationId,
        createdById: userId,
        maxTeams: dto.maxTeams,
        startDate: new Date(dto.startDate),
        registrationClosesAt: dto.registrationClosesAt ? new Date(dto.registrationClosesAt) : null,
        format,
      },
      include: TOURNAMENT_INCLUDE,
    });

    return toResponse(tournament);
  }

  async findAll(
    pagination: PaginationParams,
    filters?: {
      sportId?: string;
      status?: string;
      startAfter?: string;
      startBefore?: string;
    }
  ): Promise<PaginatedResult<TournamentResponseDto>> {
    const where: Record<string, unknown> = {};

    if (filters?.sportId) {
      where.sportId = filters.sportId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.startAfter || filters?.startBefore) {
      const startDate: Record<string, Date> = {};
      if (filters.startAfter) startDate.gte = new Date(filters.startAfter);
      if (filters.startBefore) startDate.lte = new Date(filters.startBefore);
      where.startDate = startDate;
    }

    return paginate(
      pagination,
      () => prisma.tournament.count({ where }),
      ({ skip, take }) =>
        prisma.tournament
          .findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            include: TOURNAMENT_INCLUDE,
          })
          .then((tournaments) => tournaments.map(toResponse))
    );
  }

  async search(
    query: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<TournamentResponseDto>> {
    const where = {
      name: { contains: query, mode: 'insensitive' as const },
    };

    return paginate(
      pagination,
      () => prisma.tournament.count({ where }),
      ({ skip, take }) =>
        prisma.tournament
          .findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            include: TOURNAMENT_INCLUDE,
          })
          .then((tournaments) => tournaments.map(toResponse))
    );
  }

  async findOne(id: string): Promise<TournamentResponseDto> {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: TOURNAMENT_INCLUDE,
    });

    if (!tournament) throw new NotFoundException('Tournament not found');

    return toResponse(tournament);
  }

  async update(
    id: string,
    dto: UpdateTournamentDto,
    userId: string
  ): Promise<TournamentResponseDto> {
    const tournament = await prisma.tournament.findUnique({ where: { id } });
    if (!tournament) throw new NotFoundException('Tournament not found');

    await this.requireOrgManager(tournament.organizationId, userId);

    if (dto.maxTeams !== undefined) {
      if (tournament.format === 'SINGLE_ELIMINATION' && !isPowerOfTwo(dto.maxTeams)) {
        throw new BadRequestException('maxTeams must be a power of 2 (e.g. 2, 4, 8, 16, 32)');
      }
    }

    if (dto.status !== undefined && dto.status !== tournament.status) {
      this.assertValidStatusTransition(tournament.status, dto.status);
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.maxTeams !== undefined) data.maxTeams = dto.maxTeams;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.registrationClosesAt !== undefined) {
      data.registrationClosesAt =
        dto.registrationClosesAt === null ? null : new Date(dto.registrationClosesAt);
    }

    const updated = await prisma.tournament.update({
      where: { id },
      data,
      include: TOURNAMENT_INCLUDE,
    });

    return toResponse(updated);
  }

  private assertValidStatusTransition(from: TournamentStatus, to: TournamentStatus): void {
    // Forward-only progression. CLOSED bridges OPEN→INPROGRESS so registration
    // can be locked without immediately starting matches; UPCOMING is a status
    // for "registration over, not yet started". COMPLETED is terminal.
    const allowed: Record<TournamentStatus, TournamentStatus[]> = {
      OPEN: ['CLOSED', 'UPCOMING', 'INPROGRESS', 'COMPLETED'],
      CLOSED: ['OPEN', 'UPCOMING', 'INPROGRESS', 'COMPLETED'],
      UPCOMING: ['INPROGRESS', 'COMPLETED'],
      INPROGRESS: ['COMPLETED'],
      COMPLETED: [],
    };
    if (!allowed[from].includes(to)) {
      throw new BadRequestException(
        `Invalid tournament status transition: ${from} → ${to}. Allowed from ${from}: ${allowed[from].join(', ') || '(terminal state)'}.`
      );
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: { select: { id: true, name: true, captainId: true } } },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    await this.requireOrgManager(tournament.organizationId, userId);

    await prisma.tournament.delete({ where: { id } });

    // Notify all team captains that the tournament was deleted
    for (const team of tournament.teams) {
      await this.notificationService.create(
        team.captainId,
        'TOURNAMENT_DELETED',
        'Tournament Deleted',
        `Tournament "${tournament.name}" has been deleted`
      );
    }
  }

  // ─── Team Registration ─────────────────────────────────

  async joinTournament(
    tournamentId: string,
    teamId: string,
    userId: string
  ): Promise<TournamentResponseDto> {
    await this.moderationService.assertAllowed(userId, 'TOURNAMENT_REGISTER');

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: { select: { id: true } } },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');

    if (tournament.status !== 'OPEN') {
      throw new BadRequestException('Tournament is not open for registration');
    }

    if (tournament.registrationClosesAt && new Date() >= tournament.registrationClosesAt) {
      throw new BadRequestException('Registration window has closed');
    }

    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { users: true } });
    if (!team) throw new NotFoundException('Team not found');

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can register for tournaments');
    }

    if (team.sportId !== tournament.sportId) {
      throw new BadRequestException('Team sport does not match the tournament sport');
    }

    if (tournament.teams.some((t) => t.id === teamId)) {
      throw new BadRequestException('Team is already registered for this tournament');
    }

    if (tournament.teams.length >= tournament.maxTeams) {
      throw new BadRequestException('Tournament has reached maximum team capacity');
    }

    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data: { teams: { connect: { id: teamId } } },
      include: TOURNAMENT_INCLUDE,
    });
    for (const user of team.users) {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          users: { connect: { id: user.id } },
          userProfiles: { connect: { userId: user.id } },
        },
        include: TOURNAMENT_INCLUDE,
      });
    }
    return toResponse(updated);
  }

  async leaveTournament(tournamentId: string, teamId: string, userId: string): Promise<void> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: { select: { id: true } } },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');

    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { users: true } });
    if (!team) throw new NotFoundException('Team not found');

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can withdraw from tournaments');
    }

    if (!tournament.teams.some((t) => t.id === teamId)) {
      throw new BadRequestException('Team is not registered for this tournament');
    }

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { teams: { disconnect: { id: teamId } } },
    });
    for (const user of team.users) {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          users: { connect: { id: user.id } },
          userProfiles: { disconnect: { userId: user.id } },
        },
        include: TOURNAMENT_INCLUDE,
      });
    }
  }

  async addTeam(
    tournamentId: string,
    teamId: string,
    userId: string
  ): Promise<TournamentResponseDto> {
    const team1 = await prisma.team.findUnique({ where: { id: teamId }, include: { users: true } });
    if (!team1) throw new NotFoundException('Team not found');

    if (team1.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can register for tournaments');
    }
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: { select: { id: true } } },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.requireOrgManager(tournament.organizationId, userId);

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');

    if (team.sportId !== tournament.sportId) {
      throw new BadRequestException('Team sport does not match the tournament sport');
    }

    if (tournament.teams.some((t) => t.id === teamId)) {
      throw new BadRequestException('Team is already registered for this tournament');
    }

    if (tournament.teams.length >= tournament.maxTeams) {
      throw new BadRequestException('Tournament has reached maximum team capacity');
    }

    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data: { teams: { connect: { id: teamId } } },
      include: TOURNAMENT_INCLUDE,
    });
    for (const user of team1.users) {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          users: { connect: { id: user.id } },
          userProfiles: { connect: { userId: user.id } },
        },
        include: TOURNAMENT_INCLUDE,
      });
    }
    return toResponse(updated);
  }

  async removeTeam(tournamentId: string, teamId: string, userId: string): Promise<void> {
    const team1 = await prisma.team.findUnique({ where: { id: teamId }, include: { users: true } });
    if (!team1) throw new NotFoundException('Team not found');

    if (team1.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can register for tournaments');
    }
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: { select: { id: true } } },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.requireOrgManager(tournament.organizationId, userId);

    if (!tournament.teams.some((t) => t.id === teamId)) {
      throw new BadRequestException('Team is not registered for this tournament');
    }

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { teams: { disconnect: { id: teamId } } },
    });
    for (const user of team1.users) {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          users: { connect: { id: user.id } },
          userProfiles: { connect: { userId: user.id } },
        },
        include: TOURNAMENT_INCLUDE,
      });
    }
  }

  // ─── Tournament Invitations ──────────────────────────────

  async sendTournamentInvitation(
    tournamentId: string,
    teamId: string,
    userId: string
  ): Promise<TournamentInvitationResponseDto> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');

    await this.requireOrgManager(tournament.organizationId, userId);

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');

    if (team.sportId !== tournament.sportId) {
      throw new BadRequestException('Team sport does not match the tournament sport');
    }

    const existing = await prisma.tournamentInvitation.findFirst({
      where: { tournamentId, teamId, status: 'PENDING' },
    });

    if (existing) {
      throw new BadRequestException('An invitation is already pending for this team');
    }

    const invitation = await prisma.tournamentInvitation.create({
      data: { tournamentId, teamId },
    });

    await this.notificationService.create(
      team.captainId,
      'TOURNAMENT_INVITE',
      'Tournament Invitation',
      `Your team "${team.name}" has been invited to tournament "${tournament.name}"`
    );

    return this.toInvitationResponse(invitation);
  }

  async respondToTournamentInvitation(
    invitationId: string,
    userId: string,
    accept: boolean
  ): Promise<TournamentInvitationResponseDto> {
    const invitation = await prisma.tournamentInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true, tournament: true },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('This invitation has already been responded to');
    }

    if (invitation.team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can respond to tournament invitations');
    }

    if (invitation.team.sportId !== invitation.tournament.sportId) {
      throw new BadRequestException('Team sport does not match the tournament sport');
    }

    const status = accept ? 'ACCEPTED' : 'DECLINED';

    const updated = await prisma.tournamentInvitation.update({
      where: { id: invitationId },
      data: { status },
    });

    if (accept) {
      const tournament = await prisma.tournament.findUnique({
        where: { id: invitation.tournamentId },
        include: { teams: { select: { id: true } } },
      });

      if (tournament && tournament.teams.length >= tournament.maxTeams) {
        throw new BadRequestException('Tournament has reached maximum team capacity');
      }

      await prisma.tournament.update({
        where: { id: invitation.tournamentId },
        data: { teams: { connect: { id: invitation.teamId } } },
      });
    }

    return this.toInvitationResponse(updated);
  }

  async getTournamentInvitations(
    tournamentId: string,
    userId: string
  ): Promise<TournamentInvitationResponseDto[]> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');

    await this.requireOrgManager(tournament.organizationId, userId);

    const invitations = await prisma.tournamentInvitation.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => this.toInvitationResponse(inv));
  }

  // ─── Bracket & Matches ──────────────────────────────────

  async generateBracket(
    tournamentId: string,
    userId: string
  ): Promise<TournamentBracketResponseDto> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: { select: { id: true, name: true, captainId: true } },
        matches: { select: { id: true } },
      },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.requireOrgManager(tournament.organizationId, userId);

    if (tournament.matches.length > 0) {
      throw new BadRequestException('Matches have already been generated for this tournament');
    }

    if (tournament.teams.length < 2) {
      throw new BadRequestException('At least 2 teams are required to generate matches');
    }

    if (tournament.format === 'ROUND_ROBIN') {
      return this.generateRoundRobin(tournamentId, tournament.teams);
    }

    return this.generateSingleElimination(tournamentId, tournament.teams);
  }

  private async generateSingleElimination(
    tournamentId: string,
    tournamentTeams: { id: string; name: string; captainId: string }[]
  ): Promise<TournamentBracketResponseDto> {
    // Shuffle teams randomly
    const teams = [...tournamentTeams];
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teams[i], teams[j]] = [teams[j], teams[i]];
    }

    const bracketSize = nextPowerOfTwo(teams.length);
    const totalRounds = Math.log2(bracketSize);

    // Build all matches bottom-up: create later rounds first so we can link nextMatchId
    const matchIdsByRound: string[][] = [];

    // Create matches for all rounds (from final → round 1)
    for (let round = totalRounds; round >= 1; round--) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      const roundMatchIds: string[] = [];

      for (let m = 1; m <= matchesInRound; m++) {
        const nextMatchId =
          round < totalRounds
            ? matchIdsByRound[matchIdsByRound.length - 1][Math.ceil(m / 2) - 1]
            : null;

        const match = await prisma.tournamentMatch.create({
          data: {
            tournamentId,
            round,
            matchNumber: m,
            nextMatchId,
          },
        });

        roundMatchIds.push(match.id);
      }

      matchIdsByRound.push(roundMatchIds);
    }

    // Round 1 match IDs are the last array pushed
    const round1MatchIds = matchIdsByRound[matchIdsByRound.length - 1];

    // Assign teams to round 1 slots and handle byes
    for (let i = 0; i < round1MatchIds.length; i++) {
      const team1 = teams[i * 2] ?? null;
      const team2 = teams[i * 2 + 1] ?? null;

      const isBye = !team1 || !team2;
      const byeWinner = team1 ?? team2;

      await prisma.tournamentMatch.update({
        where: { id: round1MatchIds[i] },
        data: {
          team1Id: team1?.id ?? null,
          team2Id: team2?.id ?? null,
          status: isBye ? 'BYE' : 'PENDING',
          winnerId: isBye ? (byeWinner?.id ?? null) : null,
        },
      });

      // Advance bye winners to next round
      if (isBye && byeWinner) {
        const match = await prisma.tournamentMatch.findUnique({
          where: { id: round1MatchIds[i] },
        });
        if (match?.nextMatchId) {
          await this.placeWinnerInNextMatch(match.nextMatchId, byeWinner.id);
        }
      }
    }

    // Update tournament status to INPROGRESS
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'INPROGRESS' },
    });

    return this.getBracket(tournamentId);
  }

  private async generateRoundRobin(
    tournamentId: string,
    tournamentTeams: { id: string; name: string; captainId: string }[]
  ): Promise<TournamentBracketResponseDto> {
    const teams = [...tournamentTeams];

    // Generate all pairings: every team plays every other team once
    // Use the circle method for round scheduling
    const n = teams.length;
    const isOdd = n % 2 !== 0;

    // If odd number of teams, add a dummy slot for byes
    if (isOdd) {
      teams.push(null as unknown as (typeof teams)[0]);
    }

    const totalTeams = teams.length;
    const totalRounds = totalTeams - 1;

    let matchNumber = 0;

    for (let round = 1; round <= totalRounds; round++) {
      const matchesInRound = totalTeams / 2;

      for (let m = 0; m < matchesInRound; m++) {
        // Circle method: fix team[0], rotate the rest
        const home = m === 0 ? 0 : ((round - 1 + m) % (totalTeams - 1)) + 1;
        const away =
          m === 0
            ? ((round - 1) % (totalTeams - 1)) + 1
            : ((totalTeams - 1 - m + round - 1) % (totalTeams - 1)) + 1;

        const team1 = teams[home] ?? null;
        const team2 = teams[away] ?? null;

        // Skip bye matches (one team is the null dummy)
        if (!team1 || !team2) continue;

        matchNumber++;
        await prisma.tournamentMatch.create({
          data: {
            tournamentId,
            round,
            matchNumber,
            team1Id: team1.id,
            team2Id: team2.id,
            status: 'PENDING',
          },
        });
      }
    }

    // Update tournament status to INPROGRESS
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'INPROGRESS' },
    });

    return this.getBracket(tournamentId);
  }

  async getBracket(tournamentId: string): Promise<TournamentBracketResponseDto> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');

    const matches = await prisma.tournamentMatch.findMany({
      where: { tournamentId },
      include: MATCH_INCLUDE,
      orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
    });

    if (matches.length === 0) {
      throw new BadRequestException('Matches have not been generated yet');
    }

    const totalRounds = Math.max(...matches.map((m) => m.round));

    const roundsMap = new Map<number, TournamentMatchResponseDto[]>();
    for (const m of matches) {
      const dto = this.toMatchResponse(m);
      let roundMatches = roundsMap.get(m.round);
      if (!roundMatches) {
        roundMatches = [];
        roundsMap.set(m.round, roundMatches);
      }
      roundMatches.push(dto);
    }

    return {
      tournamentId,
      totalRounds,
      rounds: Array.from(roundsMap.entries()).map(([round, roundMatches]) => ({
        round,
        label: roundLabel(round, totalRounds),
        matches: roundMatches,
      })),
    };
  }

  async getStandings(tournamentId: string): Promise<TournamentStandingsResponseDto> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: { select: { id: true, name: true, captainId: true } },
      },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');

    if (tournament.format !== 'ROUND_ROBIN') {
      throw new BadRequestException('Standings are only available for round robin tournaments');
    }

    const matches = await prisma.tournamentMatch.findMany({
      where: { tournamentId, status: 'COMPLETED' },
    });

    // Build standings map
    const standingsMap = new Map<
      string,
      {
        wins: number;
        losses: number;
        draws: number;
        played: number;
        pointsFor: number;
        pointsAgainst: number;
      }
    >();

    for (const team of tournament.teams) {
      standingsMap.set(team.id, {
        wins: 0,
        losses: 0,
        draws: 0,
        played: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    }

    for (const match of matches) {
      if (!match.team1Id || !match.team2Id) continue;
      const s1 = standingsMap.get(match.team1Id);
      const s2 = standingsMap.get(match.team2Id);
      if (!s1 || !s2) continue;

      s1.played++;
      s2.played++;
      s1.pointsFor += match.team1Score ?? 0;
      s1.pointsAgainst += match.team2Score ?? 0;
      s2.pointsFor += match.team2Score ?? 0;
      s2.pointsAgainst += match.team1Score ?? 0;

      if (match.winnerId === match.team1Id) {
        s1.wins++;
        s2.losses++;
      } else if (match.winnerId === match.team2Id) {
        s2.wins++;
        s1.losses++;
      } else {
        // Draw (no winner)
        s1.draws++;
        s2.draws++;
      }
    }

    const standings = tournament.teams
      .map((team) => {
        const s = standingsMap.get(team.id);
        if (!s) {
          throw new Error(`Missing standings entry for team ${team.id}`);
        }
        return {
          team: { id: team.id, name: team.name, captainId: team.captainId },
          played: s.played,
          wins: s.wins,
          losses: s.losses,
          draws: s.draws,
          pointsFor: s.pointsFor,
          pointsAgainst: s.pointsAgainst,
          pointDiff: s.pointsFor - s.pointsAgainst,
        };
      })
      .sort((a, b) => b.wins - a.wins || b.pointDiff - a.pointDiff);

    return { tournamentId, standings };
  }

  async recordMatchResult(
    tournamentId: string,
    matchId: string,
    dto: RecordMatchResultDto,
    userId: string
  ): Promise<TournamentMatchResponseDto> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.requireOrgManager(tournament.organizationId, userId);

    if (tournament.status !== 'INPROGRESS') {
      throw new BadRequestException('Tournament is not in progress');
    }

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: {
        ...MATCH_INCLUDE,
        nextMatch: true,
      },
    });

    if (!match || match.tournamentId !== tournamentId) {
      throw new NotFoundException('Match not found in this tournament');
    }

    if (match.status !== 'PENDING') {
      throw new BadRequestException('Match has already been completed');
    }

    if (!match.team1Id || !match.team2Id) {
      throw new BadRequestException('Both teams must be assigned before recording a result');
    }

    const isRoundRobin = tournament.format === 'ROUND_ROBIN';

    if (!isRoundRobin && dto.team1Score === dto.team2Score) {
      throw new BadRequestException('Scores cannot be tied in single elimination');
    }

    const isDraw = dto.team1Score === dto.team2Score;
    const winnerId = isDraw
      ? null
      : dto.team1Score > dto.team2Score
        ? match.team1Id
        : match.team2Id;

    const updated = await prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        team1Score: dto.team1Score,
        team2Score: dto.team2Score,
        winnerId,
        status: 'COMPLETED',
      },
      include: MATCH_INCLUDE,
    });

    if (isRoundRobin) {
      // Check if all round robin matches are completed
      const pendingCount = await prisma.tournamentMatch.count({
        where: { tournamentId, status: 'PENDING' },
      });

      if (pendingCount === 0) {
        await prisma.tournament.update({
          where: { id: tournamentId },
          data: { status: 'COMPLETED' },
        });
      }

      // Award match win achievement (fire-and-forget)
      if (winnerId) {
        this.awardMatchAchievements(winnerId, false).catch((err) =>
          this.logger.error(
            `Failed to award match achievements for team ${winnerId} (round-robin)`,
            err
          )
        );
      }

      // If tournament just completed, award tournament win to top-standing team
      if (pendingCount === 0) {
        this.awardRoundRobinWinner(tournamentId).catch((err) =>
          this.logger.error(
            `Failed to award round-robin winner for tournament ${tournamentId}`,
            err
          )
        );
      }
    } else {
      // Single elimination bracket progression
      if (match.nextMatchId && winnerId) {
        await this.placeWinnerInNextMatch(match.nextMatchId, winnerId);
      } else if (!match.nextMatchId) {
        // This was the final — mark tournament as COMPLETED
        await prisma.tournament.update({
          where: { id: tournamentId },
          data: { status: 'COMPLETED' },
        });
      }

      // Award achievements to winning team members (fire-and-forget)
      if (winnerId) {
        this.awardMatchAchievements(winnerId, !match.nextMatchId).catch((err) =>
          this.logger.error(
            `Failed to award match achievements for team ${winnerId} (single-elim)`,
            err
          )
        );
      }
    }

    return this.toMatchResponse(updated);
  }

  // ─── Captain-driven score reporting (two-team confirmation) ─────────

  /**
   * A team captain reports a tentative score. The match enters
   * PENDING_CONFIRMATION; the opposing captain must `confirmMatchResult` to
   * finalize, or `disputeMatchResult` to escalate to org staff. Org staff can
   * still bypass the flow entirely with `recordMatchResult`.
   */
  async reportMatchResult(
    tournamentId: string,
    matchId: string,
    dto: RecordMatchResultDto,
    userId: string
  ): Promise<TournamentMatchResponseDto> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (tournament.status !== 'INPROGRESS') {
      throw new BadRequestException('Tournament is not in progress');
    }

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: MATCH_INCLUDE,
    });
    if (!match || match.tournamentId !== tournamentId) {
      throw new NotFoundException('Match not found in this tournament');
    }
    if (match.status !== 'PENDING' && match.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException('Match is not in a reportable state');
    }
    if (!match.team1Id || !match.team2Id) {
      throw new BadRequestException('Both teams must be assigned before reporting a result');
    }

    const reportingTeamId = await this.requireCaptainOfMatchTeam(match, userId);

    const updated = await prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        team1Score: dto.team1Score,
        team2Score: dto.team2Score,
        status: 'PENDING_CONFIRMATION',
        reportedByTeamId: reportingTeamId,
        scoreReportedAt: new Date(),
      },
      include: MATCH_INCLUDE,
    });

    // Notify the opposing captain.
    const opposingTeamId = reportingTeamId === match.team1Id ? match.team2Id : match.team1Id;
    const opposingCaptain = await prisma.team.findUnique({
      where: { id: opposingTeamId },
      select: { captainId: true },
    });
    if (opposingCaptain) {
      await this.notificationService
        .create(
          opposingCaptain.captainId,
          'TOURNAMENT_MATCH_RESULT_PENDING',
          'Score awaiting your confirmation',
          'A score has been reported for one of your matches. Confirm or dispute it.',
          { tournamentId, matchId }
        )
        .catch((err) => this.logger.warn('Failed to send score-pending notification', err));
    }

    return this.toMatchResponse(updated);
  }

  async confirmMatchResult(
    tournamentId: string,
    matchId: string,
    userId: string
  ): Promise<TournamentMatchResponseDto> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (tournament.status !== 'INPROGRESS') {
      throw new BadRequestException('Tournament is not in progress');
    }

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { ...MATCH_INCLUDE, nextMatch: true },
    });
    if (!match || match.tournamentId !== tournamentId) {
      throw new NotFoundException('Match not found in this tournament');
    }
    if (match.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException('Match is not awaiting confirmation');
    }
    if (!match.team1Id || !match.team2Id || !match.reportedByTeamId) {
      throw new BadRequestException('Match is missing team or report data');
    }
    if (match.team1Score == null || match.team2Score == null) {
      throw new BadRequestException('Reported scores are missing');
    }

    const confirmingTeamId = await this.requireCaptainOfMatchTeam(match, userId);
    if (confirmingTeamId === match.reportedByTeamId) {
      throw new ForbiddenException('The reporting team cannot confirm their own score');
    }

    return this.finalizeMatch(tournament, match, match.team1Score, match.team2Score, 'COMPLETED');
  }

  async disputeMatchResult(
    tournamentId: string,
    matchId: string,
    userId: string
  ): Promise<TournamentMatchResponseDto> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: MATCH_INCLUDE,
    });
    if (!match || match.tournamentId !== tournamentId) {
      throw new NotFoundException('Match not found in this tournament');
    }
    if (match.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException('Match is not awaiting confirmation');
    }

    const disputingTeamId = await this.requireCaptainOfMatchTeam(match, userId);
    if (disputingTeamId === match.reportedByTeamId) {
      throw new ForbiddenException('The reporting team cannot dispute their own score');
    }

    const updated = await prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        team1Score: null,
        team2Score: null,
        reportedByTeamId: null,
        scoreReportedAt: null,
        status: 'PENDING',
      },
      include: MATCH_INCLUDE,
    });

    // Notify org staff via a simple notification on the tournament creator.
    await this.notificationService
      .create(
        tournament.createdById,
        'TOURNAMENT_MATCH_RESULT_DISPUTED',
        'Match score disputed',
        'A reported tournament score has been disputed and needs staff review.',
        { tournamentId, matchId }
      )
      .catch((err) => this.logger.warn('Failed to send dispute notification', err));

    return this.toMatchResponse(updated);
  }

  // ─── Forfeit (org staff only) ───────────────────────────────────────

  async forfeitMatch(
    tournamentId: string,
    matchId: string,
    forfeitingTeamId: string,
    userId: string
  ): Promise<TournamentMatchResponseDto> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.requireOrgManager(tournament.organizationId, userId);

    if (tournament.status !== 'INPROGRESS') {
      throw new BadRequestException('Tournament is not in progress');
    }

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { ...MATCH_INCLUDE, nextMatch: true },
    });
    if (!match || match.tournamentId !== tournamentId) {
      throw new NotFoundException('Match not found in this tournament');
    }
    if (match.status === 'COMPLETED' || match.status === 'FORFEIT' || match.status === 'BYE') {
      throw new BadRequestException('Match is already finalized');
    }
    if (!match.team1Id || !match.team2Id) {
      throw new BadRequestException('Both teams must be assigned to forfeit a match');
    }
    if (forfeitingTeamId !== match.team1Id && forfeitingTeamId !== match.team2Id) {
      throw new BadRequestException('Forfeiting team is not in this match');
    }

    const winnerId = forfeitingTeamId === match.team1Id ? match.team2Id : match.team1Id;
    const updated = await prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        team1Score: forfeitingTeamId === match.team1Id ? 0 : 1,
        team2Score: forfeitingTeamId === match.team2Id ? 0 : 1,
        winnerId,
        status: 'FORFEIT',
        reportedByTeamId: null,
        scoreReportedAt: null,
      },
      include: MATCH_INCLUDE,
    });

    if (tournament.format !== 'ROUND_ROBIN' && match.nextMatchId) {
      await this.placeWinnerInNextMatch(match.nextMatchId, winnerId);
    } else if (tournament.format !== 'ROUND_ROBIN' && !match.nextMatchId) {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'COMPLETED' },
      });
    }

    const forfeitingCaptain = await prisma.team.findUnique({
      where: { id: forfeitingTeamId },
      select: { captainId: true },
    });
    if (forfeitingCaptain) {
      await this.notificationService
        .create(
          forfeitingCaptain.captainId,
          'TOURNAMENT_FORFEIT_RECORDED',
          'Match forfeit recorded',
          'A staff member has recorded a forfeit for one of your matches.',
          { tournamentId, matchId }
        )
        .catch((err) => this.logger.warn('Failed to send forfeit notification', err));
    }

    return this.toMatchResponse(updated);
  }

  /** Shared finalization path for confirmed matches. */
  private async finalizeMatch(
    tournament: { id: string; format: string },
    match: {
      id: string;
      team1Id: string | null;
      team2Id: string | null;
      nextMatchId?: string | null;
    },
    team1Score: number,
    team2Score: number,
    status: 'COMPLETED'
  ): Promise<TournamentMatchResponseDto> {
    if (!match.team1Id || !match.team2Id) {
      throw new BadRequestException('Both teams must be assigned to finalize a match');
    }

    const isRoundRobin = tournament.format === 'ROUND_ROBIN';
    if (!isRoundRobin && team1Score === team2Score) {
      throw new BadRequestException('Scores cannot be tied in single elimination');
    }

    const winnerId =
      team1Score === team2Score ? null : team1Score > team2Score ? match.team1Id : match.team2Id;

    const updated = await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        team1Score,
        team2Score,
        winnerId,
        status,
        reportedByTeamId: null,
        scoreReportedAt: null,
      },
      include: MATCH_INCLUDE,
    });

    if (isRoundRobin) {
      const pendingCount = await prisma.tournamentMatch.count({
        where: { tournamentId: tournament.id, status: { in: ['PENDING', 'PENDING_CONFIRMATION'] } },
      });
      if (pendingCount === 0) {
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: { status: 'COMPLETED' },
        });
        if (winnerId) {
          this.awardMatchAchievements(winnerId, false).catch(() => undefined);
        }
        this.awardRoundRobinWinner(tournament.id).catch(() => undefined);
      } else if (winnerId) {
        this.awardMatchAchievements(winnerId, false).catch(() => undefined);
      }
    } else {
      if (match.nextMatchId && winnerId) {
        await this.placeWinnerInNextMatch(match.nextMatchId, winnerId);
      } else if (!match.nextMatchId) {
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: { status: 'COMPLETED' },
        });
      }
      if (winnerId) {
        this.awardMatchAchievements(winnerId, !match.nextMatchId).catch(() => undefined);
      }
    }

    return this.toMatchResponse(updated);
  }

  private async requireCaptainOfMatchTeam(
    match: { team1Id: string | null; team2Id: string | null },
    userId: string
  ): Promise<string> {
    const teamIds = [match.team1Id, match.team2Id].filter((id): id is string => Boolean(id));
    if (teamIds.length === 0) {
      throw new BadRequestException('Match has no teams assigned');
    }
    const captaincies = await prisma.team.findMany({
      where: { id: { in: teamIds }, captainId: userId },
      select: { id: true },
    });
    if (captaincies.length === 0) {
      throw new ForbiddenException(
        'You must be the captain of one of the participating teams to perform this action'
      );
    }
    return captaincies[0].id;
  }

  private async placeWinnerInNextMatch(nextMatchId: string, winnerId: string): Promise<void> {
    const nextMatch = await prisma.tournamentMatch.findUnique({
      where: { id: nextMatchId },
    });
    if (!nextMatch) return;

    // Place in team1 slot if empty, otherwise team2
    const data = !nextMatch.team1Id ? { team1Id: winnerId } : { team2Id: winnerId };

    await prisma.tournamentMatch.update({
      where: { id: nextMatchId },
      data,
    });
  }

  private async awardMatchAchievements(winningTeamId: string, isFinal: boolean): Promise<void> {
    const team = await prisma.team.findUnique({
      where: { id: winningTeamId },
      include: { users: { select: { id: true } } },
    });
    if (!team) return;

    const memberIds = [team.captainId, ...team.users.map((u) => u.id)];
    const uniqueIds = [...new Set(memberIds)];

    for (const uid of uniqueIds) {
      await this.achievementService.incrementProgress(uid, 'TOURNAMENT_MATCH_WIN');
      if (isFinal) {
        await this.achievementService.incrementProgress(uid, 'TOURNAMENT_WIN');
      }
    }
  }

  private async awardRoundRobinWinner(tournamentId: string): Promise<void> {
    const standings = await this.getStandings(tournamentId);
    if (standings.standings.length === 0) return;

    const winnerTeamId = standings.standings[0].team.id;
    await this.awardMatchAchievements(winnerTeamId, true);
  }

  private toMatchResponse(match: {
    id: string;
    round: number;
    matchNumber: number;
    team1: { id: string; name: string; captainId: string } | null;
    team2: { id: string; name: string; captainId: string } | null;
    team1Score: number | null;
    team2Score: number | null;
    winner: { id: string; name: string; captainId: string } | null;
    status: string;
    nextMatchId: string | null;
    reportedByTeamId?: string | null;
    scoreReportedAt?: Date | null;
  }): TournamentMatchResponseDto {
    return {
      id: match.id,
      round: match.round,
      matchNumber: match.matchNumber,
      team1: match.team1,
      team2: match.team2,
      team1Score: match.team1Score,
      team2Score: match.team2Score,
      winner: match.winner,
      status: match.status as TournamentMatchResponseDto['status'],
      nextMatchId: match.nextMatchId,
      reportedByTeamId: match.reportedByTeamId ?? null,
      scoreReportedAt: match.scoreReportedAt?.toISOString() ?? null,
    };
  }

  private toInvitationResponse(invitation: {
    id: string;
    tournamentId: string;
    teamId: string;
    status: string;
    createdAt: Date;
  }): TournamentInvitationResponseDto {
    return {
      id: invitation.id,
      tournamentId: invitation.tournamentId,
      teamId: invitation.teamId,
      status: invitation.status,
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  async seedBracketFromStandings(
    tournamentId: string,
    userId: string
  ): Promise<TournamentBracketResponseDto> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: { select: { id: true, name: true, captainId: true } },
        matches: { select: { id: true, round: true, status: true } },
      },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.requireOrgManager(tournament.organizationId, userId);

    if (tournament.format !== 'ROUND_ROBIN') {
      throw new BadRequestException(
        'Bracket seeding from standings is only valid for round-robin tournaments'
      );
    }

    if (tournament.matches.length === 0) {
      throw new BadRequestException('Round robin has not yet been generated');
    }

    const pending = tournament.matches.find((m) => m.status === 'PENDING');
    if (pending) {
      throw new BadRequestException(
        'All round robin matches must be completed before seeding the bracket'
      );
    }

    const standings = await this.getStandings(tournamentId);
    const ordered = standings.standings
      .map((s) => tournament.teams.find((t) => t.id === s.team.id))
      .filter((t): t is { id: string; name: string; captainId: string } => !!t);

    if (ordered.length < 2) {
      throw new BadRequestException('At least 2 teams are required to seed a bracket');
    }

    // Clear existing round-robin matches — we're transitioning into a bracket phase.
    await prisma.tournamentMatch.deleteMany({ where: { tournamentId } });

    // Reseed: 1 v N, 2 v N-1, etc.
    const seeded: typeof ordered = [];
    const half = Math.ceil(ordered.length / 2);
    for (let i = 0; i < half; i++) {
      seeded.push(ordered[i]);
      const mirror = ordered[ordered.length - 1 - i];
      if (mirror && mirror.id !== ordered[i].id) {
        seeded.push(mirror);
      }
    }

    return this.generateSingleEliminationBracket(tournamentId, seeded);
  }

  // Same as generateSingleElimination but skips the random shuffle (for seeded brackets).
  private async generateSingleEliminationBracket(
    tournamentId: string,
    seededTeams: { id: string; name: string; captainId: string }[]
  ): Promise<TournamentBracketResponseDto> {
    const teams = seededTeams;
    const bracketSize = nextPowerOfTwo(teams.length);
    const totalRounds = Math.log2(bracketSize);

    const matchIdsByRound: string[][] = [];

    for (let round = totalRounds; round >= 1; round--) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      const roundMatchIds: string[] = [];

      for (let m = 1; m <= matchesInRound; m++) {
        const nextMatchId =
          round < totalRounds
            ? matchIdsByRound[matchIdsByRound.length - 1][Math.ceil(m / 2) - 1]
            : null;

        const match = await prisma.tournamentMatch.create({
          data: { tournamentId, round, matchNumber: m, nextMatchId },
        });
        roundMatchIds.push(match.id);
      }

      matchIdsByRound.push(roundMatchIds);
    }

    const round1MatchIds = matchIdsByRound[matchIdsByRound.length - 1];

    for (let i = 0; i < round1MatchIds.length; i++) {
      const team1 = teams[i * 2] ?? null;
      const team2 = teams[i * 2 + 1] ?? null;
      const isBye = !team1 || !team2;
      const byeWinner = team1 ?? team2;

      await prisma.tournamentMatch.update({
        where: { id: round1MatchIds[i] },
        data: {
          team1Id: team1?.id ?? null,
          team2Id: team2?.id ?? null,
          status: isBye ? 'BYE' : 'PENDING',
          winnerId: isBye ? (byeWinner?.id ?? null) : null,
        },
      });

      if (isBye && byeWinner) {
        const match = await prisma.tournamentMatch.findUnique({
          where: { id: round1MatchIds[i] },
        });
        if (match?.nextMatchId) {
          await this.placeWinnerInNextMatch(match.nextMatchId, byeWinner.id);
        }
      }
    }

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'INPROGRESS' },
    });

    return this.getBracket(tournamentId);
  }

  async listRecaps(tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const recaps = await prisma.tournamentRecap.findMany({
      where: { tournamentId },
      include: { video: true },
      orderBy: { createdAt: 'desc' },
    });

    return recaps.map((r) => ({
      id: r.id,
      tournamentId: r.tournamentId,
      uploadedById: r.uploadedById,
      createdAt: r.createdAt.toISOString(),
      video: videoToResponse(r.video),
    }));
  }

  async addRecap(tournamentId: string, videoId: string, userId: string) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.status !== 'COMPLETED') {
      throw new BadRequestException('Recap videos can only be added to completed tournaments');
    }

    await this.requireOrgManager(tournament.organizationId, userId);

    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const existing = await prisma.tournamentRecap.findUnique({
      where: { tournamentId_videoId: { tournamentId, videoId } },
    });
    if (existing) {
      throw new BadRequestException('Video is already linked to this tournament');
    }

    const recap = await prisma.tournamentRecap.create({
      data: { tournamentId, videoId, uploadedById: userId },
      include: { video: true },
    });

    return {
      id: recap.id,
      tournamentId: recap.tournamentId,
      uploadedById: recap.uploadedById,
      createdAt: recap.createdAt.toISOString(),
      video: videoToResponse(recap.video),
    };
  }

  async removeRecap(tournamentId: string, recapId: string, userId: string) {
    const recap = await prisma.tournamentRecap.findUnique({
      where: { id: recapId },
      include: { tournament: true },
    });
    if (!recap || recap.tournamentId !== tournamentId) {
      throw new NotFoundException('Recap not found');
    }

    await this.requireOrgManager(recap.tournament.organizationId, userId);

    await prisma.tournamentRecap.delete({ where: { id: recapId } });
  }

  private async requireOrgManager(organizationId: string, userId: string): Promise<void> {
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (!(['STAFF', 'ADMIN'] as string[]).includes(membership.role)) {
      throw new ForbiddenException(`Requires STAFF or ADMIN role. You have: ${membership.role}`);
    }
  }
}
