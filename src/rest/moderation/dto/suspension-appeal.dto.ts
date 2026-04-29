import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SuspensionAppealStatus } from '@/generated/prisma/enums';

export class SubmitSuspensionAppealDto {
  @ApiProperty({
    type: String,
    description: 'The user’s case for lifting the suspension. 10-2000 chars.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;
}

export class DecideSuspensionAppealDto {
  @ApiProperty({ enum: ['APPROVED', 'DENIED'] })
  @IsIn(['APPROVED', 'DENIED'])
  decision!: 'APPROVED' | 'DENIED';

  @ApiPropertyOptional({ type: String, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class SuspensionAppealResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  suspensionId!: string;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Display name of the appealing user. Populated on mod-side endpoints; null on self-service responses.',
  })
  userName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  userUsername!: string | null;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({ enum: SuspensionAppealStatus })
  status!: keyof typeof SuspensionAppealStatus;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}
