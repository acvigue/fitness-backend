import { Injectable } from '@nestjs/common';
import { prisma } from '@/shared/utils';
import type { SportResponseDto } from './dto/sport-response.dto';

@Injectable()
export class SportService {
  async findAll(): Promise<SportResponseDto[]> {
    const sports = await prisma.sport.findMany({
      orderBy: { name: 'asc' },
    });

    return sports.map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
    }));
  }
}
