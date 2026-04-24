import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';

export interface UserBlockResponse {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

@Injectable()
export class UserBlockService {
  async block(blockerId: string, blockedId: string): Promise<UserBlockResponse> {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }
    const target = await prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');

    const block = await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
    return this.toResponse(block);
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    const existing = await prisma.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    if (!existing) throw new NotFoundException('Block not found');
    await prisma.userBlock.delete({ where: { id: existing.id } });
  }

  async listBlocks(blockerId: string): Promise<UserBlockResponse[]> {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
    });
    return blocks.map((b) => this.toResponse(b));
  }

  async isBlocked(aId: string, bId: string): Promise<boolean> {
    const count = await prisma.userBlock.count({
      where: {
        OR: [
          { blockerId: aId, blockedId: bId },
          { blockerId: bId, blockedId: aId },
        ],
      },
    });
    return count > 0;
  }

  async didBlock(blockerId: string, blockedId: string): Promise<boolean> {
    const count = await prisma.userBlock.count({
      where: { blockerId, blockedId },
    });
    return count > 0;
  }

  private toResponse(b: {
    id: string;
    blockerId: string;
    blockedId: string;
    createdAt: Date;
  }): UserBlockResponse {
    return {
      id: b.id,
      blockerId: b.blockerId,
      blockedId: b.blockedId,
      createdAt: b.createdAt.toISOString(),
    };
  }
}
