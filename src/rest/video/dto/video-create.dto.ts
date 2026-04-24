import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export class VideoCreateDto {
  @ApiProperty({ description: 'Video name', example: 'Cool Video', type: String })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Video description', example: 'Cool stuff happens', type: String })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    description: 'Sport ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsUUID()
  sportId!: string;

  @ApiProperty({ description: 'Video url', example: '123.123.123', type: String })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({ description: 'Video MIME type', example: 'video/mp4', type: String })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ description: 'Video size in bytes', example: 1048576, type: Number })
  @IsInt()
  @Min(0)
  size!: number;
}
