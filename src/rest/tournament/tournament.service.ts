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
import type { TournamentStandingsResponseDto } from './dto/tournament-standings-response.dto';

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
      { wins: number; losses: number; draws: number; played: number; pointsFor: number; pointsAgainst: number }
    >();

    for (const team of tournament.teams) {
      standingsMap.set(team.id, { wins: 0, losses: 0, draws: 0, played: 0, pointsFor: 0, pointsAgainst: 0 });
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
        const s = standingsMap.get(team.id)!;
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
        this.awardMatchAchievements(winnerId, false).catch(() => {});
      }

      // If tournament just completed, award tournament win to top-standing team
      if (pendingCount === 0) {
        this.awardRoundRobinWinner(tournamentId).catch(() => {});
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
        this.awardMatchAchievements(winnerId, !match.nextMatchId).catch(() => {});
      }
    }

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
