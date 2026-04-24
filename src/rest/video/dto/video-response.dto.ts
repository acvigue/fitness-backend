import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/rest/common/pagination';

export class VideoResponseDto {
  @ApiProperty({ description: 'Video ID', example: 'cm123abc456def789ghi0001', type: String })
  id!: string;

  @ApiProperty({ description: 'Video name', example: 'Cool Video', type: String })
  name!: string;

  @ApiProperty({
    description: 'Video description',
    example: 'Cool stuff happens',
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

  @ApiProperty({ description: 'Video url', type: String })
  url!: string;

  @ApiProperty({ description: 'Video MIME type', example: 'video/mp4', type: String })
  mimeType!: string;

  @ApiProperty({ description: 'Video size in bytes', example: 1048576, type: Number })
  size!: number;
}

export class PaginatedVideoResponseDto {
  @ApiProperty({ type: [VideoResponseDto] })
  data!: VideoResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
