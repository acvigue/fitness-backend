import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { CreateTeamBlockDto } from './dto/create-team-block.dto';
import type { TeamBlockResponseDto } from './dto/team-block-response.dto';

@Injectable()
export class TeamBlockService {
  async blockTeam(
    teamId: string,
    dto: CreateTeamBlockDto,
    userId: string
  ): Promise<TeamBlockResponseDto> {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can block teams');
    }

    if (dto.blockedTeamId === teamId) {
      throw new BadRequestException('Cannot block your own team');
    }

    const blockedTeam = await prisma.team.findUnique({ where: { id: dto.blockedTeamId } });
    if (!blockedTeam) throw new NotFoundException('Target team not found');

    const existing = await prisma.teamBlock.findUnique({
      where: {
        blockingTeamId_blockedTeamId: {
          blockingTeamId: teamId,
          blockedTeamId: dto.blockedTeamId,
        },
      },
    });
    if (existing) throw new ConflictException('Team is already blocked');

    const block = await prisma.teamBlock.create({
      data: { blockingTeamId: teamId, blockedTeamId: dto.blockedTeamId },
      include: { blockedTeam: { select: { name: true } } },
    });

    return {
      id: block.id,
      blockingTeamId: block.blockingTeamId,
      blockedTeamId: block.blockedTeamId,
      blockedTeamName: block.blockedTeam.name,
      createdAt: block.createdAt.toISOString(),
    };
  }

  async getBlockedTeams(teamId: string, userId: string): Promise<TeamBlockResponseDto[]> {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can view blocked teams');
    }

    const blocks = await prisma.teamBlock.findMany({
      where: { blockingTeamId: teamId },
      include: { blockedTeam: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((b) => ({
      id: b.id,
      blockingTeamId: b.blockingTeamId,
      blockedTeamId: b.blockedTeamId,
      blockedTeamName: b.blockedTeam.name,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  async unblockTeam(teamId: string, blockedTeamId: string, userId: string): Promise<void> {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');

    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can unblock teams');
    }

    const block = await prisma.teamBlock.findUnique({
      where: {
        blockingTeamId_blockedTeamId: {
          blockingTeamId: teamId,
          blockedTeamId,
        },
      },
    });

    if (!block) throw new NotFoundException('Block not found');

    await prisma.teamBlock.delete({ where: { id: block.id } });
  }

  /** Returns true if either team has blocked the other (bidirectional). */
  async isBlockedEitherWay(teamAId: string, teamBId: string): Promise<boolean> {
    const count = await prisma.teamBlock.count({
      where: {
        OR: [
          { blockingTeamId: teamAId, blockedTeamId: teamBId },
          { blockingTeamId: teamBId, blockedTeamId: teamAId },
        ],
      },
    });
    return count > 0;
  }
}
