import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/utils'; // your Prisma client

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async logSession(userId: string, ip: string, userAgent: string, geoLocation?: string) {
    return this.prisma.session.create({
      data: {
        userId,
        ip,
        userAgent,
        geoLocation,
      },
    });
  }

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string, userId: string) {
    return this.prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });
  }
}