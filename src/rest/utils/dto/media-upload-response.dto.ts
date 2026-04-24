import { ApiProperty } from '@nestjs/swagger';

export class MediaUploadResponseDto {
  @ApiProperty({ description: 'Media UUID', example: 'cm1abc123def456', type: String })
  id!: string;

  @ApiProperty({
    description: 'Public URL of the uploaded file',
    example: 'https://assets.fittime.app/fittime/assets/cm1abc123def456',
    type: String,
  })
  url!: string;

  @ApiProperty({ description: 'MIME type of the file', example: 'image/png', type: String })
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes', example: 102400, type: Number })
  size!: number;
}
