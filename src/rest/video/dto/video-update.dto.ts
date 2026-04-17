import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class VideoUpdateDto {
  @ApiProperty({ description: 'Video name', example: 'Purdue Badminton A' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Sport ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  sportId!: string;

  @ApiProperty({
    description: 'Video description',
    example: 'Updated description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
  
  @ApiProperty({ description: 'Video url', example: '123.123.123' })
  @IsString()
  @IsNotEmpty()
  url!: string;
}
