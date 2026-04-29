import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GymSlotStatus } from '@/generated/prisma/enums';

export class GymSlotResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  gymId!: string;

  @ApiProperty({ format: 'date-time', type: String })
  startsAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  endsAt!: string;

  @ApiProperty({ enum: GymSlotStatus })
  status!: keyof typeof GymSlotStatus;

  @ApiPropertyOptional({ nullable: true, type: String })
  reservedByTeamId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  note!: string | null;
}
