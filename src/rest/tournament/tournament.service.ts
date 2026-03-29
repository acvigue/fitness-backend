import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { PaginationParams } from '@/rest/common/pagination';
import { paginate, type PaginatedResult } from '@/rest/common/pagination';
import type { CreateTournamentDto } from './dto/create-tournament.dto';
import type { UpdateTournamentDto } from './dto/update-tournament.dto';
import type { TournamentResponseDto } from './dto/tournament-response.dto';

const TOURNAMENT_INCLUDE = {
  sport: true,
  users: { select: { id: true, username: true, name: true, email: true } },
  teams: { select: { id: true, name: true, captainId: true } },
} as const;

function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

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
