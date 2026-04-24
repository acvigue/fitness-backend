import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateBroadcastDto {
  @ApiProperty({ description: 'Broadcast message content', example: 'Practice at 6pm tonight!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export class BroadcastResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  authorId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class BroadcastStatsResponseDto {
  @ApiProperty()
  broadcastId!: string;

  @ApiProperty({ description: 'Number of recipients who received the broadcast' })
  delivered!: number;

  @ApiProperty({ description: 'Number of recipients who marked the broadcast as read' })
  read!: number;

  @ApiProperty({ description: 'Total recipients at time of dispatch' })
  total!: number;
}
