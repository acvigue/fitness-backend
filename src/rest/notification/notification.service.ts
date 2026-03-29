import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { NotificationResponseDto } from './dto/notification-response.dto';

@Injectable()
export class NotificationService {
  async findAll(userId: string): Promise<NotificationResponseDto[]> {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map((n) => this.toResponse(n));
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

  async create(
    userId: string,
    type: string,
    title: string,
    content: string
  ): Promise<NotificationResponseDto> {
    const notification = await prisma.notification.create({
      data: { userId, type, title, content },
    });

    return this.toResponse(notification);
  }

  private toResponse(notification: {
    id: string;
    type: string;
    title: string;
    content: string;
    dismissed: boolean;
    createdAt: Date;
  }): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      dismissed: notification.dismissed,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
