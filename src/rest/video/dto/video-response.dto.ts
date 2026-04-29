import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/rest/common/pagination';

export const VIDEO_STATUSES = ['PENDING', 'PROCESSING', 'READY', 'ERRORED'] as const;
export type VideoStatusValue = (typeof VIDEO_STATUSES)[number];

export class VideoResponseDto {
  @ApiProperty({ description: 'Video ID', example: 'cm123abc456def789ghi0001', type: String })
  id!: string;

  @ApiProperty({ description: 'Video name', example: 'Tournament Final', type: String })
  name!: string;

  @ApiProperty({
    description: 'Video description',
    example: 'Final match of the spring tournament',
    type: String,
  })
  description!: string;

  @ApiProperty({ description: 'Video uploader user ID', type: String })
  uploaderId!: string;

  @ApiProperty({
    description: 'Sport ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  sportId!: string;

  @ApiProperty({
    description: 'Processing status of the video',
    enum: VIDEO_STATUSES,
    example: 'READY',
  })
  status!: VideoStatusValue;

  @ApiPropertyOptional({
    description: 'HLS playback URL — present once status is READY',
    example: 'https://stream.mux.com/abc123.m3u8',
    type: String,
  })
  playbackUrl!: string | null;

  @ApiPropertyOptional({
    description: 'Thumbnail URL — present once status is READY',
    example: 'https://image.mux.com/abc123/thumbnail.jpg',
    type: String,
  })
  thumbnailUrl!: string | null;

  @ApiPropertyOptional({
    description: 'Duration in seconds — present once status is READY',
    example: 123.45,
    type: Number,
  })
  durationSec!: number | null;

  @ApiPropertyOptional({
    description: 'Aspect ratio (width:height) — present once status is READY',
    example: '16:9',
    type: String,
  })
  aspectRatio!: string | null;

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp', format: 'date-time' })
  updatedAt!: Date;
}

export class VideoCreateResponseDto {
  @ApiProperty({ description: 'The created video record', type: VideoResponseDto })
  video!: VideoResponseDto;

  @ApiProperty({
    description:
      'Mux direct-upload URL — PUT the video file here. The browser should use UpChunk for chunked, resumable uploads.',
    example: 'https://storage.googleapis.com/video-storage-...',
    type: String,
  })
  uploadUrl!: string;
}

export class PaginatedVideoResponseDto {
  @ApiProperty({ type: [VideoResponseDto] })
  data!: VideoResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
