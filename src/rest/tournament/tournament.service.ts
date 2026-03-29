import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import { AchievementService } from '@/rest/achievement/achievement.service';
import type { PaginationParams } from '@/rest/common/pagination';
import { paginate, type PaginatedResult } from '@/rest/common/pagination';
import type { CreateTournamentDto } from './dto/create-tournament.dto';
import type { UpdateTournamentDto } from './dto/update-tournament.dto';
import type { RecordMatchResultDto } from './dto/record-match-result.dto';
import type { TournamentResponseDto } from './dto/tournament-response.dto';
import type { TournamentInvitationResponseDto } from './dto/tournament-invitation-response.dto';
import type { TournamentBracketResponseDto } from './dto/tournament-bracket-response.dto';
import type { TournamentMatchResponseDto } from './dto/tournament-match-response.dto';

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
  status: string;
  maxTeams: number;
  organizationId: string;
  createdById: string;
  startDate: Date;
  createdAt: Date;
  sport: { id: string; name: string; icon: string | null };
  users: { id: string; username: string | null; name: string | null; email: string | null }[];
  teams: { id: string; name: string; captainId: string }[];
}): TournamentResponseDto {
  return {
    id: tournament.id,
    name: tournament.name,
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
  };
}

@Injectable()
export class TournamentService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly achievementService: AchievementService
  ) {}

  async create(dto: CreateTournamentDto, userId: string): Promise<TournamentResponseDto> {
    if (!isPowerOfTwo(dto.maxTeams)) {
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

    if (dto.maxTeams !== undefined && !isPowerOfTwo(dto.maxTeams)) {
      throw new BadRequestException('maxTeams must be a power of 2 (e.g. 2, 4, 8, 16, 32)');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.maxTeams !== undefined) data.maxTeams = dto.maxTeams;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await prisma.tournament.update({
      where: { id },
      data,
      include: TOURNAMENT_INCLUDE,
    });

    return toResponse(updated);
  }

  async delete(id: string, userId: string): Promise<void> {
    const tournament = await prisma.tournament.findUnique({ where: { id } });
    if (!tournament) throw new NotFoundException('Tournament not found');

    await this.requireOrgManager(tournament.organizationId, userId);

    await prisma.tournament.delete({ where: { id } });
  }

  // ─── Team Registration ─────────────────────────────────

  async joinTournament(
    tournamentId: string,
    teamId: string,
    userId: string
  ): Promise<TournamentResponseDto> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: { select: { id: true } } },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');

    if (tournament.status !== 'OPEN') {
      throw new BadRequestException('Tournament is not open for registration');
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can register for tournaments');
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

    return toResponse(updated);
  }

  async leaveTournament(tournamentId: string, teamId: string, userId: string): Promise<void> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: { select: { id: true } } },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');

    const team = await prisma.team.findUnique({ where: { id: teamId } });
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
  }

  async addTeam(
    tournamentId: string,
    teamId: string,
    userId: string
  ): Promise<TournamentResponseDto> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { teams: { select: { id: true } } },
    });

    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.requireOrgManager(tournament.organizationId, userId);

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

    return toResponse(updated);
  }

  async removeTeam(tournamentId: string, teamId: string, userId: string): Promise<void> {
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

    const existing = await prisma.tournamentInvitation.findFirst({
      where: { tournamentId, teamId, status: 'PENDING' },
    });

    if (existing) {
      throw new BadRequestException('An invitation is already pending for this team');
    }

    const invitation = await prisma.tournamentInvitation.create({
      data: { tournamentId, teamId },
    });

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (team) {
      await this.notificationService.create(
        team.captainId,
        'TOURNAMENT_INVITE',
        'Tournament Invitation',
        `Your team "${team.name}" has been invited to tournament "${tournament.name}"`
      );
    }

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
      throw new BadRequestException('Bracket has already been generated for this tournament');
    }

    if (tournament.teams.length < 2) {
      throw new BadRequestException('At least 2 teams are required to generate a bracket');
    }

    // Shuffle teams randomly
    const teams = [...tournament.teams];
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
          winnerId: isBye ? byeWinner?.id ?? null : null,
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
      throw new BadRequestException('Bracket has not been generated yet');
    }

    const totalRounds = Math.max(...matches.map((m) => m.round));

    const roundsMap = new Map<number, TournamentMatchResponseDto[]>();
    for (const m of matches) {
      const dto = this.toMatchResponse(m);
      if (!roundsMap.has(m.round)) roundsMap.set(m.round, []);
      roundsMap.get(m.round)!.push(dto);
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

    if (dto.team1Score === dto.team2Score) {
      throw new BadRequestException('Scores cannot be tied in single elimination');
    }

    const winnerId = dto.team1Score > dto.team2Score ? match.team1Id : match.team2Id;

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

    // Advance winner to next match
    if (match.nextMatchId) {
      await this.placeWinnerInNextMatch(match.nextMatchId, winnerId);
    } else {
      // This was the final — mark tournament as COMPLETED
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'COMPLETED' },
      });
    }

    // Award achievements to winning team members (fire-and-forget)
    this.awardMatchAchievements(winnerId, !match.nextMatchId).catch(() => {});

    return this.toMatchResponse(updated);
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

  private async awardMatchAchievements(
    winningTeamId: string,
    isFinal: boolean
  ): Promise<void> {
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
