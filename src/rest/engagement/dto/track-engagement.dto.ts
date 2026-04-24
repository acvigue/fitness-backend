import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { EngagementType } from '@/generated/prisma/enums';

export class TrackEngagementDto {
  @ApiProperty({ type: String })
  @IsString()
  userId!: string;

  @ApiProperty({ enum: EngagementType })
  @IsEnum(EngagementType)
  type!: EngagementType;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  targetUserId?: string;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsOptional()
  chatId?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
