import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import { CreateGymDto, WeeklyAvailabilityRuleDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';
import type { GymSlotResponseDto } from './dto/gym-slot.dto';
import type {
  CreateClosureDto,
  CreateExceptionDto,
  CreateReservationDto,
  EffectiveAvailabilityQueryDto,
  EffectiveSlotDto,
  GymAvailabilityExceptionResponseDto,
  ReplaceRulesDto,
} from './dto/gym-schedule.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_AVAILABILITY_RANGE_DAYS = 62;
// Prisma stores `dayOfWeek` as 0=Monday..6=Sunday. JS Date#getUTCDay returns 0=Sunday..6=Saturday.
// This converts JS to our domain encoding.
function jsDayToDomainDay(jsDay: number): number {
  return (jsDay + 6) % 7;
}

interface Interval {
  start: Date;
  end: Date;
}

@Injectable()
export class GymService {
  constructor(private readonly notificationService: NotificationService) {}

  // ===========================================================================
  // Gym CRUD
  // ===========================================================================

  async create(createGymDto: CreateGymDto, userId: string) {
    const weeklyRules = createGymDto.weeklyRules ?? [];
    this.validateWeeklyRules(weeklyRules);
    await this.ensureOrgStaff(userId, createGymDto.organizationId);

    const gym = await prisma.$transaction(async (tx) => {
      const createdGym = await tx.gym.create({
        data: {
          name: createGymDto.name,
          organizationId: createGymDto.organizationId,
          description: createGymDto.description,
          location: createGymDto.location,
          capacity: createGymDto.capacity,
          isActive: createGymDto.isActive ?? true,
        },
      });

      if (weeklyRules.length > 0) {
        await tx.gymAvailabilityRule.createMany({
          data: weeklyRules.map((rule) => ({
            gymId: createdGym.id,
            dayOfWeek: rule.dayOfWeek,
            startTime: rule.startTime,
            endTime: rule.endTime,
            isOpen: rule.isOpen,
          })),
        });
      }

      return tx.gym.findUniqueOrThrow({
        where: { id: createdGym.id },
        include: {
          availabilityRules: {
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          },
          availabilityExceptions: {
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          },
        },
      });
    });

    return gym;
  }

  async findAll() {
    return prisma.gym.findMany({
      include: {
        availabilityRules: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByOrganization(organizationId: string) {
    return prisma.gym.findMany({
      where: { organizationId },
      include: {
        availabilityRules: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const gym = await prisma.gym.findUnique({
      where: { id },
      include: {
        availabilityRules: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
        availabilityExceptions: {
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        },
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with id "${id}" not found`);
    }

    return gym;
  }

  async update(id: string, data: UpdateGymDto, userId: string) {
    const existing = await this.getForStaffMutation(id, userId);

    if (data.organizationId !== undefined && data.organizationId !== existing.organizationId) {
      await this.ensureOrgStaff(userId, data.organizationId);
    }

    const weeklyRules = data.weeklyRules;
    if (weeklyRules) {
      this.validateWeeklyRules(weeklyRules);
    }

    return prisma.$transaction(async (tx) => {
      await tx.gym.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.organizationId !== undefined && {
            organizationId: data.organizationId,
          }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.capacity !== undefined && { capacity: data.capacity }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      if (weeklyRules) {
        await tx.gymAvailabilityRule.deleteMany({ where: { gymId: id } });

        if (weeklyRules.length > 0) {
          await tx.gymAvailabilityRule.createMany({
            data: weeklyRules.map((rule) => ({
              gymId: id,
              dayOfWeek: rule.dayOfWeek,
              startTime: rule.startTime,
              endTime: rule.endTime,
              isOpen: rule.isOpen,
            })),
          });
        }
      }

      return tx.gym.findUniqueOrThrow({
        where: { id },
        include: {
          availabilityRules: {
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          },
          availabilityExceptions: {
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          },
        },
      });
    });
  }

  async remove(id: string, userId: string) {
    await this.getForStaffMutation(id, userId);
    return prisma.gym.delete({ where: { id } });
  }

  // ===========================================================================
  // Effective availability — merged view of rules ∩ ¬exceptions − concrete slots
  // ===========================================================================

  async findEffectiveAvailability(
    gymId: string,
    query: EffectiveAvailabilityQueryDto
  ): Promise<EffectiveSlotDto[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from and to must be valid ISO datetimes');
    }
    if (to <= from) {
      throw new BadRequestException('to must be after from');
    }
    if (to.getTime() - from.getTime() > MAX_AVAILABILITY_RANGE_DAYS * MS_PER_DAY) {
      throw new BadRequestException(`Range cannot exceed ${MAX_AVAILABILITY_RANGE_DAYS} days`);
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true },
    });
    if (!gym) throw new NotFoundException('Gym not found');

    const [rules, exceptions, concreteSlots] = await Promise.all([
      prisma.gymAvailabilityRule.findMany({ where: { gymId } }),
      prisma.gymAvailabilityException.findMany({
        where: {
          gymId,
          date: { gte: this.startOfUtcDay(from), lt: to },
        },
      }),
      prisma.gymSlot.findMany({
        where: {
          gymId,
          status: { in: ['RESERVED', 'CLOSED'] },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        orderBy: { startsAt: 'asc' },
      }),
    ]);

    const exceptionsByDate = new Map<string, (typeof exceptions)[number]>();
    for (const ex of exceptions) {
      exceptionsByDate.set(this.utcDateKey(ex.date), ex);
    }

    const openIntervals: { interval: Interval; source: 'RULE' | 'EXCEPTION' }[] = [];
    const dayCursor = this.startOfUtcDay(from);
    const endCursor = this.startOfUtcDay(new Date(to.getTime() - 1));
    while (dayCursor.getTime() <= endCursor.getTime()) {
      const dayKey = this.utcDateKey(dayCursor);
      const exception = exceptionsByDate.get(dayKey);
      if (exception) {
        if (!exception.isClosed && exception.startTime && exception.endTime) {
          openIntervals.push({
            interval: this.windowOnDay(dayCursor, exception.startTime, exception.endTime),
            source: 'EXCEPTION',
          });
        }
      } else {
        const domainDay = jsDayToDomainDay(dayCursor.getUTCDay());
        const dayRules = rules.filter((r) => r.dayOfWeek === domainDay);
        for (const interval of this.computeOpenIntervalsForDay(dayCursor, dayRules)) {
          openIntervals.push({ interval, source: 'RULE' });
        }
      }
      dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
    }

    const clipStart = from;
    const clipEnd = to;
    const concrete = concreteSlots.map((s) => ({
      slot: s,
      interval: { start: s.startsAt, end: s.endsAt },
    }));

    const availableSegments: EffectiveSlotDto[] = [];
    for (const { interval, source } of openIntervals) {
      const clipped = this.clipInterval(interval, clipStart, clipEnd);
      if (!clipped) continue;
      const subtracted = this.subtractIntervals(
        clipped,
        concrete.map((c) => c.interval)
      );
      for (const seg of subtracted) {
        availableSegments.push({
          startsAt: seg.start.toISOString(),
          endsAt: seg.end.toISOString(),
          status: 'AVAILABLE',
          source,
          slotId: null,
          reservedByTeamId: null,
          note: null,
        });
      }
    }

    const concreteSegments: EffectiveSlotDto[] = concrete.map(({ slot, interval }) => {
      const clipped = this.clipInterval(interval, clipStart, clipEnd) ?? interval;
      return {
        startsAt: clipped.start.toISOString(),
        endsAt: clipped.end.toISOString(),
        status: slot.status as EffectiveSlotDto['status'],
        source: 'SLOT',
        slotId: slot.id,
        reservedByTeamId: slot.reservedByTeamId,
        note: slot.note,
      };
    });

    return [...availableSegments, ...concreteSegments].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt)
    );
  }

  // ===========================================================================
  // Reservations (captain-driven)
  // ===========================================================================

  async createReservation(
    gymId: string,
    dto: CreateReservationDto,
    userId: string
  ): Promise<GymSlotResponseDto> {
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, organizationId: true },
    });
    if (!gym) throw new NotFoundException('Gym not found');

    const team = await prisma.team.findUnique({
      where: { id: dto.teamId },
      select: { id: true, captainId: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can reserve a gym slot');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('startsAt and endsAt must be valid ISO datetimes');
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    await this.ensureWindowIsOpen(gymId, { start: startsAt, end: endsAt });
    await this.ensureNoOverlap(gymId, startsAt, endsAt);

    const slot = await prisma.gymSlot.create({
      data: {
        gymId,
        startsAt,
        endsAt,
        status: 'RESERVED',
        reservedByTeamId: team.id,
        note: dto.note ?? null,
        updatedById: userId,
      },
    });

    await this.dispatchStatusChangeNotifications(gymId, slot, true);

    return this.toSlotResponse(slot);
  }

  async cancelReservation(gymId: string, slotId: string, userId: string): Promise<void> {
    const slot = await prisma.gymSlot.findUnique({
      where: { id: slotId },
      select: {
        id: true,
        gymId: true,
        status: true,
        reservedByTeamId: true,
        startsAt: true,
        endsAt: true,
        gym: { select: { organizationId: true } },
      },
    });
    if (!slot || slot.gymId !== gymId) {
      throw new NotFoundException('Reservation not found');
    }
    if (slot.status !== 'RESERVED') {
      throw new BadRequestException('Slot is not a reservation');
    }

    let allowed = false;
    if (slot.reservedByTeamId) {
      const team = await prisma.team.findUnique({
        where: { id: slot.reservedByTeamId },
        select: { captainId: true },
      });
      if (team?.captainId === userId) allowed = true;
    }
    if (!allowed) {
      const member = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: { userId, organizationId: slot.gym.organizationId },
        },
        select: { role: true },
      });
      if (member && (member.role === 'STAFF' || member.role === 'ADMIN')) {
        allowed = true;
      }
    }
    if (!allowed) {
      throw new ForbiddenException('Only the reserving team captain or org staff can cancel');
    }

    await prisma.gymSlot.delete({ where: { id: slotId } });
    await this.dispatchStatusChangeNotifications(gymId, {
      id: slot.id,
      status: 'AVAILABLE',
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });
  }

  // ===========================================================================
  // Closures (staff manual close of a window)
  // ===========================================================================

  async createClosure(
    gymId: string,
    dto: CreateClosureDto,
    userId: string
  ): Promise<GymSlotResponseDto> {
    const gym = await this.getForStaffMutation(gymId, userId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('startsAt and endsAt must be valid ISO datetimes');
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    await this.ensureNoOverlap(gym.id, startsAt, endsAt);

    const slot = await prisma.gymSlot.create({
      data: {
        gymId: gym.id,
        startsAt,
        endsAt,
        status: 'CLOSED',
        note: dto.note ?? null,
        updatedById: userId,
      },
    });

    await this.dispatchStatusChangeNotifications(gym.id, slot, true);

    return this.toSlotResponse(slot);
  }

  async removeClosure(gymId: string, slotId: string, userId: string): Promise<void> {
    await this.getForStaffMutation(gymId, userId);

    const slot = await prisma.gymSlot.findUnique({
      where: { id: slotId },
      select: { id: true, gymId: true, status: true, startsAt: true, endsAt: true },
    });
    if (!slot || slot.gymId !== gymId) {
      throw new NotFoundException('Closure not found');
    }
    if (slot.status !== 'CLOSED') {
      throw new BadRequestException('Slot is not a closure');
    }

    await prisma.gymSlot.delete({ where: { id: slotId } });
    await this.dispatchStatusChangeNotifications(gymId, {
      id: slot.id,
      status: 'AVAILABLE',
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });
  }

  // ===========================================================================
  // Schedule management (rules + exceptions, staff only)
  // ===========================================================================

  async replaceRules(gymId: string, dto: ReplaceRulesDto, userId: string) {
    await this.getForStaffMutation(gymId, userId);
    this.validateWeeklyRules(dto.rules);

    return prisma.$transaction(async (tx) => {
      await tx.gymAvailabilityRule.deleteMany({ where: { gymId } });
      if (dto.rules.length > 0) {
        await tx.gymAvailabilityRule.createMany({
          data: dto.rules.map((rule) => ({
            gymId,
            dayOfWeek: rule.dayOfWeek,
            startTime: rule.startTime,
            endTime: rule.endTime,
            isOpen: rule.isOpen,
          })),
        });
      }
      return tx.gymAvailabilityRule.findMany({
        where: { gymId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });
  }

  async createException(
    gymId: string,
    dto: CreateExceptionDto,
    userId: string
  ): Promise<GymAvailabilityExceptionResponseDto> {
    await this.getForStaffMutation(gymId, userId);

    if (!dto.isClosed) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException('Open exceptions require both startTime and endTime');
      }
      if (this.toMinutes(dto.endTime) <= this.toMinutes(dto.startTime)) {
        throw new BadRequestException('endTime must be after startTime');
      }
    }

    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date must be a valid ISO date');
    }

    const exception = await prisma.gymAvailabilityException.create({
      data: {
        gymId,
        date: this.startOfUtcDay(date),
        isClosed: dto.isClosed,
        startTime: dto.isClosed ? null : (dto.startTime ?? null),
        endTime: dto.isClosed ? null : (dto.endTime ?? null),
        note: dto.note ?? null,
      },
    });

    return this.toExceptionResponse(exception);
  }

  async removeException(gymId: string, exceptionId: string, userId: string): Promise<void> {
    await this.getForStaffMutation(gymId, userId);

    const exception = await prisma.gymAvailabilityException.findUnique({
      where: { id: exceptionId },
      select: { id: true, gymId: true },
    });
    if (!exception || exception.gymId !== gymId) {
      throw new NotFoundException('Exception not found');
    }

    await prisma.gymAvailabilityException.delete({ where: { id: exceptionId } });
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private async getForStaffMutation(id: string, userId: string) {
    const gym = await prisma.gym.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });
    if (!gym) {
      throw new NotFoundException(`Gym with id "${id}" not found`);
    }
    await this.ensureOrgStaff(userId, gym.organizationId);
    return gym;
  }

  private async ensureOrgStaff(userId: string, organizationId: string) {
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true },
    });
    if (!membership || (membership.role !== 'STAFF' && membership.role !== 'ADMIN')) {
      throw new ForbiddenException('Only organization staff or admins can manage this gym');
    }
  }

  private async ensureNoOverlap(gymId: string, startsAt: Date, endsAt: Date) {
    const conflict = await prisma.gymSlot.findFirst({
      where: {
        gymId,
        status: { in: ['RESERVED', 'CLOSED'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true, status: true },
    });
    if (conflict) {
      throw new ConflictException(
        `Time range overlaps with an existing ${conflict.status.toLowerCase()} slot`
      );
    }
  }

  private async ensureWindowIsOpen(gymId: string, window: Interval) {
    const [rules, exceptions] = await Promise.all([
      prisma.gymAvailabilityRule.findMany({ where: { gymId } }),
      prisma.gymAvailabilityException.findMany({
        where: {
          gymId,
          date: {
            gte: this.startOfUtcDay(window.start),
            lt: new Date(this.startOfUtcDay(window.end).getTime() + MS_PER_DAY),
          },
        },
      }),
    ]);

    const exceptionsByDate = new Map<string, (typeof exceptions)[number]>();
    for (const ex of exceptions) {
      exceptionsByDate.set(this.utcDateKey(ex.date), ex);
    }

    const openIntervals: Interval[] = [];
    const dayCursor = this.startOfUtcDay(window.start);
    const lastDay = this.startOfUtcDay(new Date(window.end.getTime() - 1));
    while (dayCursor.getTime() <= lastDay.getTime()) {
      const dayKey = this.utcDateKey(dayCursor);
      const exception = exceptionsByDate.get(dayKey);
      if (exception) {
        if (!exception.isClosed && exception.startTime && exception.endTime) {
          openIntervals.push(this.windowOnDay(dayCursor, exception.startTime, exception.endTime));
        }
      } else {
        const domainDay = jsDayToDomainDay(dayCursor.getUTCDay());
        const dayRules = rules.filter((r) => r.dayOfWeek === domainDay);
        for (const interval of this.computeOpenIntervalsForDay(dayCursor, dayRules)) {
          openIntervals.push(interval);
        }
      }
      dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
    }

    if (!this.intervalCoveredBy(window, openIntervals)) {
      throw new BadRequestException('Requested window is not within the gym’s open hours');
    }
  }

  private computeOpenIntervalsForDay(
    day: Date,
    dayRules: { startTime: string; endTime: string; isOpen: boolean }[]
  ): Interval[] {
    if (dayRules.length === 0) return [];
    const opens = dayRules
      .filter((r) => r.isOpen)
      .map((r) => this.windowOnDay(day, r.startTime, r.endTime));
    if (opens.length === 0) return [];
    const closes = dayRules
      .filter((r) => !r.isOpen)
      .map((r) => this.windowOnDay(day, r.startTime, r.endTime));
    return opens.flatMap((o) => this.subtractIntervals(o, closes));
  }

  private windowOnDay(day: Date, startTime: string, endTime: string): Interval {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const start = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), sh, sm, 0, 0)
    );
    const end = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), eh, em, 0, 0)
    );
    return { start, end };
  }

  private subtractIntervals(base: Interval, subtractors: Interval[]): Interval[] {
    let result: Interval[] = [{ start: base.start, end: base.end }];
    for (const sub of subtractors) {
      const next: Interval[] = [];
      for (const r of result) {
        if (sub.end <= r.start || sub.start >= r.end) {
          next.push(r);
          continue;
        }
        if (sub.start > r.start) {
          next.push({ start: r.start, end: sub.start < r.end ? sub.start : r.end });
        }
        if (sub.end < r.end) {
          next.push({ start: sub.end > r.start ? sub.end : r.start, end: r.end });
        }
      }
      result = next.filter((iv) => iv.end > iv.start);
      if (result.length === 0) break;
    }
    return result;
  }

  private clipInterval(iv: Interval, clipStart: Date, clipEnd: Date): Interval | null {
    const start = iv.start < clipStart ? clipStart : iv.start;
    const end = iv.end > clipEnd ? clipEnd : iv.end;
    if (end <= start) return null;
    return { start, end };
  }

  private intervalCoveredBy(target: Interval, intervals: Interval[]): boolean {
    const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
    let cursor = target.start;
    for (const iv of sorted) {
      if (iv.start > cursor) return false;
      if (iv.end > cursor) cursor = iv.end;
      if (cursor >= target.end) return true;
    }
    return cursor >= target.end;
  }

  private startOfUtcDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private utcDateKey(d: Date): string {
    return this.startOfUtcDay(d).toISOString().slice(0, 10);
  }

  private validateWeeklyRules(rules: WeeklyAvailabilityRuleDto[]) {
    const sorted = [...rules].sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.startTime.localeCompare(b.startTime);
    });

    for (const rule of sorted) {
      const startMinutes = this.toMinutes(rule.startTime);
      const endMinutes = this.toMinutes(rule.endTime);

      if (endMinutes <= startMinutes) {
        throw new BadRequestException(
          `Invalid rule for day ${rule.dayOfWeek}: endTime must be after startTime`
        );
      }
    }

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      if (prev.dayOfWeek !== curr.dayOfWeek) continue;

      const prevEnd = this.toMinutes(prev.endTime);
      const currStart = this.toMinutes(curr.startTime);

      if (currStart < prevEnd) {
        throw new BadRequestException(
          `Overlapping weekly rules detected on day ${curr.dayOfWeek}: ${prev.startTime}-${prev.endTime} overlaps ${curr.startTime}-${curr.endTime}`
        );
      }
    }
  }

  private toMinutes(value: string): number {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private async dispatchStatusChangeNotifications(
    gymId: string,
    slot: { id: string; status: string; startsAt: Date; endsAt: Date },
    isNew = false
  ): Promise<void> {
    const subscriptions = await prisma.gymSubscription.findMany({
      where: { gymId },
      select: { userId: true },
    });
    if (subscriptions.length === 0) return;

    const title = isNew ? 'New gym availability' : 'Gym availability updated';
    const content = isNew
      ? `A gym you watch has a new ${slot.status} slot at ${slot.startsAt.toISOString()}.`
      : `A gym you watch now has status ${slot.status}.`;
    await this.notificationService.createMany(
      subscriptions.map((s) => ({
        userId: s.userId,
        type: 'GYM_STATUS_CHANGED',
        title,
        content,
        metadata: { gymId, slotId: slot.id, status: slot.status },
      }))
    );
  }

  private toSlotResponse(slot: {
    id: string;
    gymId: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    reservedByTeamId: string | null;
    note: string | null;
  }): GymSlotResponseDto {
    return {
      id: slot.id,
      gymId: slot.gymId,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      status: slot.status as GymSlotResponseDto['status'],
      reservedByTeamId: slot.reservedByTeamId,
      note: slot.note,
    };
  }

  private toExceptionResponse(exception: {
    id: string;
    gymId: string;
    date: Date;
    isClosed: boolean;
    startTime: string | null;
    endTime: string | null;
    note: string | null;
  }): GymAvailabilityExceptionResponseDto {
    return {
      id: exception.id,
      gymId: exception.gymId,
      date: exception.date.toISOString(),
      isClosed: exception.isClosed,
      startTime: exception.startTime,
      endTime: exception.endTime,
      note: exception.note,
    };
  }
}
