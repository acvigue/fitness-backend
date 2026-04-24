import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class VideoUpdateDto {
  @ApiProperty({ description: 'Video name', example: 'Purdue Badminton A', type: String })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Sport ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsUUID()
  sportId!: string;

  @ApiProperty({
    description: 'Video description',
    example: 'Updated description',
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Video url', example: '123.123.123', type: String })
  @IsString()
  @IsNotEmpty()
  url!: string;
}
