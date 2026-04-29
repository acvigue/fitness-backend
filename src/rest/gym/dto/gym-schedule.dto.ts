import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WeeklyAvailabilityRuleDto } from './create-gym.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):([03]0)$/;

export const EFFECTIVE_SLOT_STATUSES = ['AVAILABLE', 'RESERVED', 'CLOSED'] as const;
export type EffectiveSlotStatus = (typeof EFFECTIVE_SLOT_STATUSES)[number];

export const EFFECTIVE_SLOT_SOURCES = ['RULE', 'EXCEPTION', 'SLOT'] as const;
export type EffectiveSlotSource = (typeof EFFECTIVE_SLOT_SOURCES)[number];

export class EffectiveSlotDto {
  @ApiProperty({ format: 'date-time', type: String })
  startsAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  endsAt!: string;

  @ApiProperty({ enum: EFFECTIVE_SLOT_STATUSES })
  status!: EffectiveSlotStatus;

  @ApiProperty({
    enum: EFFECTIVE_SLOT_SOURCES,
    description:
      'Where this segment came from: RULE = recurring weekly schedule, EXCEPTION = date-specific override, SLOT = concrete reservation/closure row',
  })
  source!: EffectiveSlotSource;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Concrete GymSlot id when source is SLOT',
  })
  slotId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  reservedByTeamId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  note!: string | null;
}

export class EffectiveAvailabilityQueryDto {
  @ApiProperty({
    format: 'date-time',
    description: 'Window start (inclusive). ISO 8601.',
    type: String,
  })
  @IsDateString()
  from!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Window end (exclusive). ISO 8601. Must be within 62 days of from.',
    type: String,
  })
  @IsDateString()
  to!: string;
}

export class CreateReservationDto {
  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  endsAt!: string;

  @ApiProperty({ description: 'Team that will use the gym', type: String })
  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @ApiPropertyOptional({ type: String, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateClosureDto {
  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ type: String, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReplaceRulesDto {
  @ApiProperty({ type: [WeeklyAvailabilityRuleDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => WeeklyAvailabilityRuleDto)
  rules!: WeeklyAvailabilityRuleDto[];
}

export class CreateExceptionDto {
  @ApiProperty({
    format: 'date',
    description: 'Date the exception applies to (YYYY-MM-DD). UTC.',
    type: String,
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    description: 'When true, the gym is fully closed that day regardless of startTime/endTime',
    type: Boolean,
  })
  @IsBoolean()
  isClosed!: boolean;

  @ApiPropertyOptional({
    description: 'Override start time (HH:MM, 30-minute increments). Required if isClosed=false.',
    type: String,
  })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm 30-minute increments' })
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Override end time (HH:MM, 30-minute increments). Required if isClosed=false.',
    type: String,
  })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:mm 30-minute increments' })
  endTime?: string;

  @ApiPropertyOptional({ type: String, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class GymAvailabilityExceptionResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  gymId!: string;

  @ApiProperty({ format: 'date-time', type: String })
  date!: string;

  @ApiProperty({ type: Boolean })
  isClosed!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  startTime!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  endTime!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  note!: string | null;
}
