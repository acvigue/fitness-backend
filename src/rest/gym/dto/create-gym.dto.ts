import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const TIME_PATTERN = /^([01]\d|2[0-3]):([03]0)$/;

export class WeeklyAvailabilityRuleDto {
  @ApiProperty({
    description: 'Day of week where 0=Monday and 6=Sunday',
    example: 0,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({
    description: 'Start time in 30-minute increments',
    example: '08:00',
  })
  @IsString()
  @Matches(TIME_PATTERN, {
    message: 'startTime must be in HH:mm format and use 30-minute increments',
  })
  startTime!: string;

  @ApiProperty({
    description: 'End time in 30-minute increments',
    example: '17:30',
  })
  @IsString()
  @Matches(TIME_PATTERN, {
    message: 'endTime must be in HH:mm format and use 30-minute increments',
  })
  endTime!: string;

  @ApiProperty({
    description: 'Whether this recurring time range is open',
    example: true,
  })
  @IsBoolean()
  isOpen!: boolean;
}

export class CreateGymDto {
  @ApiProperty({
    description: 'Gym name',
    example: 'Corec Main Gym',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Organization ID that owns this gym',
    example: 'clr1abc2d0000',
  })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiPropertyOptional({
    description: 'Gym description',
    example: 'Main basketball and volleyball court area',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Gym location',
    example: 'Building A, Floor 1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({
    description: 'Maximum recommended capacity',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Whether the gym is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Recurring weekly schedule rules. Use merged ranges rather than individual cells.',
    type: [WeeklyAvailabilityRuleDto],
    example: [
      { dayOfWeek: 0, startTime: '08:00', endTime: '12:00', isOpen: true },
      { dayOfWeek: 0, startTime: '12:00', endTime: '13:00', isOpen: false },
      { dayOfWeek: 0, startTime: '13:00', endTime: '17:00', isOpen: true },
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => WeeklyAvailabilityRuleDto)
  weeklyRules?: WeeklyAvailabilityRuleDto[];
}
