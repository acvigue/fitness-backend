import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import type {
  ReminderPreferenceResponseDto,
  UpdateReminderPreferenceDto,
} from './dto/reminder-preferences.dto';

const DEFAULT_INTERVALS_MINUTES = [24 * 60, 60];

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(private readonly notificationService: NotificationService) {}

  async listPreferences(userId: string): Promise<ReminderPreferenceResponseDto[]> {
    const prefs = await prisma.reminderPreference.findMany({
      where: { userId },
      orderBy: [{ tournamentId: 'asc' }],
    });
    return prefs.map((p) => this.toResponse(p));
  }

  async upsertPreference(
    userId: string,
    dto: UpdateReminderPreferenceDto
  ): Promise<ReminderPreferenceResponseDto> {
    const pref = await prisma.reminderPreference.upsert({
      where: {
        userId_tournamentId: { userId, tournamentId: dto.tournamentId ?? null },
      },
      create: {
        userId,
        tournamentId: dto.tournamentId ?? null,
        intervalsMinutes: dto.intervalsMinutes,
      },
      update: { intervalsMinutes: dto.intervalsMinutes },
    });
    return this.toResponse(pref);
  }

  async resolveIntervalsForUser(userId: string, tournamentId: string): Promise<number[]> {
    const specific = await prisma.reminderPreference.findUnique({
      where: { userId_tournamentId: { userId, tournamentId } },
    });
    if (specific) return specific.intervalsMinutes;

    const global = await prisma.reminderPreference.findUnique({
      where: { userId_tournamentId: { userId, tournamentId: null } },
    });
    if (global) return global.intervalsMinutes;

    return DEFAULT_INTERVALS_MINUTES;
  }

  // Runs every 5 minutes — not every minute to amortize load.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async dispatchDueReminders(): Promise<void> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tournaments = await prisma.tournament.findMany({
      where: {
        startDate: { gt: now, lte: horizon },
        status: { in: ['OPEN', 'CLOSED', 'UPCOMING'] },
      },
      include: { users: { select: { id: true } } },
    });

    for (const t of tournaments) {
      for (const participant of t.users) {
        await this.fireRemindersForUser(participant.id, t.id, t.name, t.startDate, now);
      }
    }
  }

  async fireRemindersForUser(
    userId: string,
    tournamentId: string,
    tournamentName: string,
    startDate: Date,
    now: Date
  ): Promise<void> {
    const intervals = await this.resolveIntervalsForUser(userId, tournamentId);
    const minutesUntilStart = Math.floor((startDate.getTime() - now.getTime()) / 60000);

    for (const intervalMinutes of intervals) {
      if (minutesUntilStart > intervalMinutes) continue;

      try {
        await prisma.reminderDispatch.create({
          data: { userId, tournamentId, intervalMinutes },
        });
      } catch {
        // Duplicate (@@unique) — already dispatched for this interval
        continue;
      }

      const label =
        intervalMinutes >= 1440
          ? `${Math.round(intervalMinutes / 1440)} day(s)`
          : `${intervalMinutes} minutes`;

      await this.notificationService.create(
        userId,
        'TOURNAMENT_REMINDER',
        'Tournament starting soon',
        `"${tournamentName}" starts in approximately ${label}.`,
        { tournamentId, intervalMinutes }
      );
    }
  }

  private toResponse(p: {
    id: string;
    tournamentId: string | null;
    intervalsMinutes: number[];
    updatedAt: Date;
  }): ReminderPreferenceResponseDto {
    return {
      id: p.id,
      tournamentId: p.tournamentId,
      intervalsMinutes: p.intervalsMinutes,
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
