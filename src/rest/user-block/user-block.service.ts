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

  /** Returns true if either user has blocked the other (bidirectional). */
  async isBlockedEitherWay(aId: string, bId: string): Promise<boolean> {
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

  /** Returns true if `blockerId` has blocked `blockedId` (unidirectional). */
  async hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const count = await prisma.userBlock.count({
      where: { blockerId, blockedId },
    });
    return count > 0;
  }

  /**
   * Returns the set of user ids that should be hidden from `userId` in any
   * shared context: anyone they've blocked plus anyone who has blocked them.
   */
  async hiddenFrom(userId: string): Promise<Set<string>> {
    const rows = await prisma.userBlock.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    });
    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
    }
    return ids;
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
