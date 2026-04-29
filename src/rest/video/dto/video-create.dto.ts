import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class VideoCreateDto {
  @ApiProperty({ description: 'Video name', example: 'Tournament Final', type: String })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Video description',
    example: 'Final match of the spring tournament',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @ApiProperty({
    description: 'Sport ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsUUID()
  sportId!: string;
}
