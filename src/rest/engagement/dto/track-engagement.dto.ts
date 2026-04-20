import { ApiProperty } from '@nestjs/swagger';
import { EngagementType } from '@/generated/prisma/enums';

export class TrackEngagementDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({
    enum: EngagementType,
  })
  type!: EngagementType;

  @ApiProperty({ required: false })
  targetUserId?: string;

  @ApiProperty({ required: false })
  teamId?: string;

  @ApiProperty({ required: false })
  chatId?: string;

  @ApiProperty({ required: false })
  metadata?: any;
}
