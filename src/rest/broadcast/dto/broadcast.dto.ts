import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateBroadcastDto {
  @ApiProperty({
    description: 'Broadcast message content',
    example: 'Practice at 6pm tonight!',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export class BroadcastResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  teamId!: string;

  @ApiProperty({ type: String })
  authorId!: string;

  @ApiProperty({ type: String })
  content!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}

export class BroadcastStatsResponseDto {
  @ApiProperty({ type: String })
  broadcastId!: string;

  @ApiProperty({ description: 'Number of recipients who received the broadcast', type: Number })
  delivered!: number;

  @ApiProperty({
    description: 'Number of recipients who marked the broadcast as read',
    type: Number,
  })
  read!: number;

  @ApiProperty({ description: 'Total recipients at time of dispatch', type: Number })
  total!: number;
}
