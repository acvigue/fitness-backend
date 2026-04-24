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
  @ApiProperty({ description: 'Suspension duration in hours', example: 24, type: Number })
  @IsInt()
  @Min(1)
  durationHours!: number;

  @ApiProperty({ description: 'Reason for the suspension', type: String })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class BanUserDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class RestrictUserDto {
  @ApiProperty({ enum: RestrictionAction, isArray: true })
  @IsEnum(RestrictionAction, { each: true })
  actions!: (keyof typeof RestrictionAction)[];

  @ApiProperty({ description: 'Duration in hours', type: Number })
  @IsInt()
  @Min(1)
  durationHours!: number;

  @ApiProperty({ type: String })
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
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class FlagMessageDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  teamId?: string;
}
