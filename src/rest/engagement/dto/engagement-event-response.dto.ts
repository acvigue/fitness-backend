import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EngagementType } from '@/generated/prisma/enums';
import { PaginationMetaDto } from '@/rest/common/pagination';

export class EngagementEventResponseDto {
  @ApiProperty({ description: 'Event ID', type: String })
  id!: string;

  @ApiProperty({ description: 'User who performed the event', type: String })
  userId!: string;

  @ApiProperty({ enum: EngagementType })
  type!: EngagementType;

  @ApiPropertyOptional({ description: 'Target user, if event is user-targeted', type: String })
  targetUserId!: string | null;

  @ApiPropertyOptional({ description: 'Team, if event is team-scoped', type: String })
  teamId!: string | null;

  @ApiPropertyOptional({ description: 'Chat, if event is chat-scoped', type: String })
  chatId!: string | null;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;
}

export class PaginatedEngagementEventResponseDto {
  @ApiProperty({ type: [EngagementEventResponseDto] })
  data!: EngagementEventResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class EngagementCountResponseDto {
  @ApiProperty({ description: 'Count', type: Number })
  count!: number;
}
