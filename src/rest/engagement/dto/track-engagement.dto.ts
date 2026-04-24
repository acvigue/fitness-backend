import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { EngagementType } from '@/generated/prisma/enums';

export class TrackEngagementDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty({ enum: EngagementType })
  @IsEnum(EngagementType)
  type!: EngagementType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  targetUserId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  chatId?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
