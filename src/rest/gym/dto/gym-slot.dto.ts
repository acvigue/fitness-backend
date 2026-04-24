import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { GymSlotStatus } from '@/generated/prisma/enums';

export class GymSlotResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  gymId!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ enum: GymSlotStatus })
  status!: keyof typeof GymSlotStatus;

  @ApiPropertyOptional({ nullable: true })
  reservedByTeamId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;
}

export class UpdateGymSlotStatusDto {
  @ApiProperty({ enum: GymSlotStatus })
  @IsEnum(GymSlotStatus)
  status!: keyof typeof GymSlotStatus;

  @ApiPropertyOptional({ description: 'Team that reserved the slot, if applicable' })
  @IsOptional()
  @IsString()
  reservedByTeamId?: string;

  @ApiPropertyOptional({ description: 'Additional note for the status change' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateGymSlotDto {
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ enum: GymSlotStatus })
  @IsOptional()
  @IsEnum(GymSlotStatus)
  status?: keyof typeof GymSlotStatus;
}

export class GymAvailabilityQueryDto {
  @ApiPropertyOptional({ format: 'date-time', description: 'Start of window (inclusive)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'End of window (exclusive)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: GymSlotStatus })
  @IsOptional()
  @IsEnum(GymSlotStatus)
  status?: keyof typeof GymSlotStatus;

  @ApiPropertyOptional({ description: 'Filter to a single gym' })
  @IsOptional()
  @IsString()
  gymId?: string;
}
