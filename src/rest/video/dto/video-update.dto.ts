import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class VideoUpdateDto {
  @ApiPropertyOptional({ description: 'Video name', example: 'Tournament Final', type: String })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Sport ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsUUID()
  @IsOptional()
  sportId?: string;

  @ApiPropertyOptional({
    description: 'Video description',
    example: 'Updated description',
    type: String,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;
}
