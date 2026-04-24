import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { CreateGymDto, WeeklyAvailabilityRuleDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';

@Injectable()
export class GymService {
  async create(createGymDto: CreateGymDto) {
    const weeklyRules = createGymDto.weeklyRules ?? [];
    this.validateWeeklyRules(weeklyRules);

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

  async update(id: string, data: UpdateGymDto) {
    await this.ensureExists(id);

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

  async remove(id: string) {
    await this.ensureExists(id);

    return prisma.gym.delete({
      where: { id },
    });
  }

  private async ensureExists(id: string) {
    const gym = await prisma.gym.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with id "${id}" not found`);
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
}
