import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/utils';
import { paginate, type PaginationParams, type PaginatedResult } from '@/rest/common/pagination';
import type { NotificationResponseDto } from './dto/notification-response.dto';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  content: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationService {
  async findAll(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    return paginate(
      pagination,
      () => prisma.notification.count({ where: { userId } }),
      ({ skip, take }) =>
        prisma.notification
          .findMany({
            where: { userId },
            skip,
            take,
            orderBy: { createdAt: 'desc' },
          })
          .then((items) => items.map((n) => this.toResponse(n)))
    );
  }

  async dismiss(id: string, userId: string): Promise<NotificationResponseDto> {
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { dismissed: true },
    });

    return this.toResponse(updated);
  }

  async markRead(id: string, userId: string): Promise<NotificationResponseDto> {
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });

    return this.toResponse(updated);
  }

  async create(
    userId: string,
    type: string,
    title: string,
    content: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<NotificationResponseDto> {
    const notification = await prisma.notification.create({
      data: { userId, type, title, content, metadata },
    });

    return this.toResponse(notification);
  }

  async createMany(entries: CreateNotificationInput[]): Promise<number> {
    if (entries.length === 0) return 0;
    const result = await prisma.notification.createMany({
      data: entries.map((e) => ({
        userId: e.userId,
        type: e.type,
        title: e.title,
        content: e.content,
        metadata: e.metadata,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  private toResponse(notification: {
    id: string;
    type: string;
    title: string;
    content: string;
    metadata: unknown;
    readAt: Date | null;
    dismissed: boolean;
    createdAt: Date;
  }): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type as NotificationResponseDto['type'],
      title: notification.title,
      content: notification.content,
      metadata: (notification.metadata as Record<string, unknown> | null) ?? null,
      readAt: notification.readAt?.toISOString() ?? null,
      dismissed: notification.dismissed,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
