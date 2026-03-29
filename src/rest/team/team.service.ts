import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { TeamCreateDto } from './dto/team-create.dto';
import type { TeamResponseDto } from './dto/team-response.dto';
import type { TeamUpdateCaptainDto } from './dto/team-update-captain.dto';
import type { TeamUpdateDto } from './dto/team-update.dto';

@Injectable()
export class TeamService {
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
    });

    return this.toResponse(updatedTeam);
  }

  async delete(id: string, userId: string): Promise<void> {
    const team = await prisma.team.findUnique({
      where: { id },
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
  }

  private toResponse(team: {
    id: string;
    name: string;
    description: string;
    captainId: string;
    sportId: string;
  }): TeamResponseDto {
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      captainId: team.captainId,
      sportId: team.sportId,
    };
  }
}
