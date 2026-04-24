import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { RestrictionAction } from '@/generated/prisma/enums';

export class SuspendUserDto {
  @ApiProperty({ description: 'Suspension duration in hours', example: 24 })
  @IsInt()
  @Min(1)
  durationHours!: number;

  @ApiProperty({ description: 'Reason for the suspension' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class BanUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class RestrictUserDto {
  @ApiProperty({ enum: RestrictionAction, isArray: true })
  @IsEnum(RestrictionAction, { each: true })
  actions!: (keyof typeof RestrictionAction)[];

  @ApiProperty({ description: 'Duration in hours' })
  @IsInt()
  @Min(1)
  durationHours!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class UnrestrictUserDto {
  @ApiProperty({ enum: RestrictionAction, isArray: true })
  @IsEnum(RestrictionAction, { each: true })
  actions!: (keyof typeof RestrictionAction)[];
}

export class DeleteMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class FlagMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string;
}
