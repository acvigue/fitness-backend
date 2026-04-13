import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGymDto } from './dto/create-gym.dto';

@Injectable()
export class GymService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createGymDto: CreateGymDto) {
    const gym = await this.prisma.gym.create({
      data: {
        name: createGymDto.name,
        organizationId: createGymDto.organizationId,
        description: createGymDto.description,
        location: createGymDto.location,
        capacity: createGymDto.capacity,
        isActive: createGymDto.isActive ?? true,
      },
    });

    return gym;
  }

  async findAll() {
    return this.prisma.gym.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByOrganization(organizationId: string) {
    return this.prisma.gym.findMany({
      where: { organizationId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with id "${id}" not found`);
    }

    return gym;
  }

  async update(id: string, data: Partial<CreateGymDto>) {
    await this.ensureExists(id);

    return this.prisma.gym.update({
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
  }

  async remove(id: string) {
    await this.ensureExists(id);

    return this.prisma.gym.delete({
      where: { id },
    });
  }

  private async ensureExists(id: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with id "${id}" not found`);
    }
  }
}
