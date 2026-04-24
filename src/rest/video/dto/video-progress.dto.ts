import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateVideoProgressDto {
  @ApiProperty({ description: 'Current playback position in seconds', example: 45 })
  @IsInt()
  @Min(0)
  positionSeconds!: number;

  @ApiProperty({
    description: 'Whether the user has completed the video',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class VideoProgressResponseDto {
  @ApiProperty()
  videoId!: string;

  @ApiProperty()
  positionSeconds!: number;

  @ApiProperty()
  completed!: boolean;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
