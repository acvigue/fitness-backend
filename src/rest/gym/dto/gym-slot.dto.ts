import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { GymSlotStatus } from '@/generated/prisma/enums';

export const GYM_SLOT_SORT_FIELDS = ['startsAt', 'endsAt', 'status', 'location'] as const;
export type GymSlotSortField = (typeof GYM_SLOT_SORT_FIELDS)[number];
export const GYM_SLOT_SORT_ORDERS = ['asc', 'desc'] as const;
export type GymSlotSortOrder = (typeof GYM_SLOT_SORT_ORDERS)[number];

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

export class UpdateGymSlotStatusDto {
  @ApiProperty({ enum: GymSlotStatus })
  @IsEnum(GymSlotStatus)
  status!: keyof typeof GymSlotStatus;

  @ApiPropertyOptional({ description: 'Team that reserved the slot, if applicable', type: String })
  @IsOptional()
  @IsString()
  reservedByTeamId?: string;

  @ApiPropertyOptional({ description: 'Additional note for the status change', type: String })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateGymSlotDto {
  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ enum: GymSlotStatus })
  @IsOptional()
  @IsEnum(GymSlotStatus)
  status?: keyof typeof GymSlotStatus;
}

export class GymAvailabilityQueryDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Start of window (inclusive)',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'End of window (exclusive)',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: GymSlotStatus })
  @IsOptional()
  @IsEnum(GymSlotStatus)
  status?: keyof typeof GymSlotStatus;

  @ApiPropertyOptional({ description: 'Filter to a single gym', type: String })
  @IsOptional()
  @IsString()
  gymId?: string;

  @ApiPropertyOptional({
    description: 'Filter slots whose gym location contains this string (case-insensitive)',
    type: String,
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: GYM_SLOT_SORT_FIELDS,
    default: 'startsAt',
  })
  @IsOptional()
  @IsIn(GYM_SLOT_SORT_FIELDS)
  sortBy?: GymSlotSortField;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: GYM_SLOT_SORT_ORDERS,
    default: 'asc',
  })
  @IsOptional()
  @IsIn(GYM_SLOT_SORT_ORDERS)
  sortOrder?: GymSlotSortOrder;
}
