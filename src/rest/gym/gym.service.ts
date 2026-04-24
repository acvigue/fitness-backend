import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { NotificationService } from '@/rest/notification/notification.service';
import { CreateGymDto, WeeklyAvailabilityRuleDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';
import type {
  CreateGymSlotDto,
  GymAvailabilityQueryDto,
  GymSlotResponseDto,
  UpdateGymSlotStatusDto,
} from './dto/gym-slot.dto';

@Injectable()
export class GymService {
  constructor(private readonly notificationService: NotificationService) {}

  async create(createGymDto: CreateGymDto, userId: string) {
    const weeklyRules = createGymDto.weeklyRules ?? [];
    this.validateWeeklyRules(weeklyRules);
    await this.ensureOrgMember(userId, createGymDto.organizationId);

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
    const existing = await this.getForMutation(id, userId);

    if (data.organizationId !== undefined && data.organizationId !== existing.organizationId) {
      await this.ensureOrgMember(userId, data.organizationId);
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
        await tx.gymAvailabilityRule.deleteMany({
          where: { gymId: id },
        });

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
    await this.getForMutation(id, userId);

    return prisma.gym.delete({
      where: { id },
    });
  }

  private async getForMutation(id: string, userId: string) {
    const gym = await prisma.gym.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with id "${id}" not found`);
    }

    await this.ensureOrgMember(userId, gym.organizationId);
    return gym;
  }

  private async ensureOrgMember(userId: string, organizationId: string) {
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this gym’s organization');
    }
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

  async listSlots(filters: GymAvailabilityQueryDto): Promise<GymSlotResponseDto[]> {
    const where: Record<string, unknown> = {};
    if (filters.gymId) where.gymId = filters.gymId;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      const start: Record<string, Date> = {};
      if (filters.from) start.gte = new Date(filters.from);
      if (filters.to) start.lt = new Date(filters.to);
      where.startsAt = start;
    }
    const slots = await prisma.gymSlot.findMany({
      where,
      orderBy: [{ startsAt: 'asc' }],
    });
    return slots.map((s) => this.toSlotResponse(s));
  }

  async createSlot(
    gymId: string,
    dto: CreateGymSlotDto,
    userId: string
  ): Promise<GymSlotResponseDto> {
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, organizationId: true },
    });
    if (!gym) throw new NotFoundException('Gym not found');
    await this.ensureOrgMember(userId, gym.organizationId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const slot = await prisma.gymSlot.create({
      data: {
        gymId,
        startsAt,
        endsAt,
        status: dto.status ?? 'AVAILABLE',
      },
    });
    return this.toSlotResponse(slot);
  }

  async updateSlotStatus(
    gymId: string,
    slotId: string,
    dto: UpdateGymSlotStatusDto,
    userId: string
  ): Promise<GymSlotResponseDto> {
    const slot = await prisma.gymSlot.findUnique({ where: { id: slotId } });
    if (!slot || slot.gymId !== gymId) {
      throw new NotFoundException('Gym slot not found');
    }

    await this.ensureTeamLeader(userId, dto.reservedByTeamId);

    const updated = await prisma.gymSlot.update({
      where: { id: slotId },
      data: {
        status: dto.status,
        reservedByTeamId: dto.reservedByTeamId ?? null,
        note: dto.note ?? null,
        updatedById: userId,
      },
    });

    await this.dispatchStatusChangeNotifications(gymId, updated);

    return this.toSlotResponse(updated);
  }

  private async ensureTeamLeader(userId: string, teamId?: string): Promise<void> {
    const captainships = await prisma.team.findMany({
      where: { captainId: userId },
      select: { id: true },
    });
    if (captainships.length === 0) {
      throw new ForbiddenException('Only team captains can update gym slot status');
    }
    if (teamId) {
      const match = captainships.find((t) => t.id === teamId);
      if (!match) {
        throw new ForbiddenException('You are not the captain of the specified team');
      }
    }
  }

  private async dispatchStatusChangeNotifications(
    gymId: string,
    slot: { id: string; status: string; startsAt: Date; endsAt: Date }
  ): Promise<void> {
    const subscriptions = await prisma.gymSubscription.findMany({
      where: { gymId },
      select: { userId: true },
    });
    if (subscriptions.length === 0) return;

    const title = 'Gym availability updated';
    const content = `A gym you watch now has status ${slot.status}.`;
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
}
