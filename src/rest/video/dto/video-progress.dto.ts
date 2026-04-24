import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateVideoProgressDto {
  @ApiProperty({ description: 'Current playback position in seconds', example: 45, type: Number })
  @IsInt()
  @Min(0)
  positionSeconds!: number;

  @ApiProperty({
    description: 'Whether the user has completed the video',
    required: false,
    default: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class VideoProgressResponseDto {
  @ApiProperty({ type: String })
  videoId!: string;

  @ApiProperty({ type: Number })
  positionSeconds!: number;

  @ApiProperty({ type: Boolean })
  completed!: boolean;

  @ApiProperty({ format: 'date-time', type: String })
  updatedAt!: string;
}
