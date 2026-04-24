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
    const tournamentId = dto.tournamentId ?? null;
    // Postgres treats NULL as distinct in UNIQUE indexes, so the (userId, tournamentId)
    // unique constraint does not collapse multiple "global" rows together. Manually
    // find-then-update or create to keep one row per (user, tournament|global) combo.
    const existing = await prisma.reminderPreference.findFirst({
      where: { userId, tournamentId },
    });
    const pref = existing
      ? await prisma.reminderPreference.update({
          where: { id: existing.id },
          data: { intervalsMinutes: dto.intervalsMinutes },
        })
      : await prisma.reminderPreference.create({
          data: { userId, tournamentId, intervalsMinutes: dto.intervalsMinutes },
        });
    return this.toResponse(pref);
  }

  async resolveIntervalsForUser(userId: string, tournamentId: string): Promise<number[]> {
    const specific = await prisma.reminderPreference.findFirst({
      where: { userId, tournamentId },
    });
    if (specific) return specific.intervalsMinutes;

    const global = await prisma.reminderPreference.findFirst({
      where: { userId, tournamentId: null },
    });
    if (global) return global.intervalsMinutes;

    return DEFAULT_INTERVALS_MINUTES;
  }

  // Runs every 5 minutes — not every minute to amortize load.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async dispatchDueReminders(): Promise<void> {
    const now = new Date();
    const maxIntervalMinutes = await this.maxConfiguredIntervalMinutes();
    const horizon = new Date(now.getTime() + maxIntervalMinutes * 60 * 1000);

    // Anything not COMPLETED is eligible — INPROGRESS tournaments may still have a
    // future start date when the bracket is generated ahead of time.
    const tournaments = await prisma.tournament.findMany({
      where: {
        startDate: { gt: now, lte: horizon },
        status: { not: 'COMPLETED' },
      },
      include: { users: { select: { id: true } } },
    });

    for (const t of tournaments) {
      for (const participant of t.users) {
        await this.fireRemindersForUser(participant.id, t.id, t.name, t.startDate, now);
      }
    }
  }

  private async maxConfiguredIntervalMinutes(): Promise<number> {
    const defaultMax = Math.max(...DEFAULT_INTERVALS_MINUTES);
    const prefs = await prisma.reminderPreference.findMany({
      select: { intervalsMinutes: true },
    });
    let max = defaultMax;
    for (const p of prefs) {
      for (const m of p.intervalsMinutes) {
        if (m > max) max = m;
      }
    }
    return max;
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
