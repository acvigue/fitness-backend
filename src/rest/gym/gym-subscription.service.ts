import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';

export interface GymSubscriptionResponse {
  id: string;
  gymId: string;
  userId: string;
  createdAt: string;
}

@Injectable()
export class GymSubscriptionService {
  async subscribe(userId: string, gymId: string): Promise<GymSubscriptionResponse> {
    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true } });
    if (!gym) throw new NotFoundException('Gym not found');

    const sub = await prisma.gymSubscription.upsert({
      where: { userId_gymId: { userId, gymId } },
      create: { userId, gymId },
      update: {},
    });
    return {
      id: sub.id,
      gymId: sub.gymId,
      userId: sub.userId,
      createdAt: sub.createdAt.toISOString(),
    };
  }

  async unsubscribe(userId: string, gymId: string): Promise<void> {
    const existing = await prisma.gymSubscription.findUnique({
      where: { userId_gymId: { userId, gymId } },
    });
    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }
    await prisma.gymSubscription.delete({ where: { id: existing.id } });
  }

  async listForUser(userId: string): Promise<GymSubscriptionResponse[]> {
    const subs = await prisma.gymSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return subs.map((s) => ({
      id: s.id,
      gymId: s.gymId,
      userId: s.userId,
      createdAt: s.createdAt.toISOString(),
    }));
  }
}
