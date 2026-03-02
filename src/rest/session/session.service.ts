import { Injectable } from '@nestjs/common';
import { prisma } from '@/shared/utils';

@Injectable()
export class SessionService {
  async logSession(userId: string, ip: string, userAgent: string, geoLocation?: string) {
    return prisma.session.create({
      data: {
        userId,
        ipAddress: ip,
        userAgent,
        location: geoLocation,
      },
    });
  }

  async getSessions(userId: string) {
    return prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string, userId: string) {
    return prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });
  }
}
