import { Injectable } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/utils';

export interface AuditLogInput {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  async log(entry: AuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        reason: entry.reason,
        metadata: entry.metadata,
      },
    });
  }

  async findByTarget(targetType: string, targetId: string) {
    return prisma.auditLog.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
