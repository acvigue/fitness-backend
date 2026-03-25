import { Injectable } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { TeamResponseDto } from './dto/team-response.dto';
import type { TeamUpdateCaptainDto } from './dto/team-update.dto';

@Injectable()
export class TeamService {
  async findAll(): Promise<TeamResponseDto[]> {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' },
    });

    return teams.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      captainId: s.captainId,
    }));
  }

  async updateCaptain(
    id: string,
    dto: TeamUpdateCaptainDto,
    userId: string
  ): Promise<TeamResponseDto> {
	const team = await prisma.team.findUnique({ where: {id} });
	if (!team) throw new NotFoundException('Team not found');
	if (userId != team.captainId) {
	  throw new ForbiddenException('You are not the current team captain');
	}
	
	const updatedTeam = await prisma.team.update({
		where: { id },
		data: { ...({ captainId: dto.captainId })}
	});
	
	return {
		id: updatedTeam.id,
		name: updatedTeam.name,
		description: updatedTeam.description,
		captainId: updatedTeam.captainId
	};
  }

  async delete(id: string, userId: string): Promise<void> {
	const team = await prisma.team.findUnique({ where: {id} });
	if (!team) throw new NotFoundException('Team not found');
	if (userId != team.captainId) {
	  throw new ForbiddenException('You are not the current team captain');
	}
	await prisma.team.delete({ where: { id } });
  }
}
