import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '@/rest/user/dto/user-response.dto';

export class VideoResponseDto {
  @ApiProperty({ description: 'Video ID', example: 'cm123abc456def789ghi0001' })
  id!: string;

  @ApiProperty({ description: 'Video name', example: 'Cool Video' })
  name!: string;

  @ApiProperty({
    description: 'Video description',
    example: 'Cool stuff happens',
  })
  description!: string;

  @ApiProperty({ description: 'Video uploader user ID' })
  uploaderId!: string;

  @ApiProperty({
    description: 'Sport ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  sportId!: string;
  
  @ApiProperty({ description: 'Video url' })
  url!: string;

}
