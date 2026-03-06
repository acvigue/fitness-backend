import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SportResponseDto {
  @ApiProperty({ description: 'Sport ID (UUID)', example: 'a1b2c3d4-0001-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'Sport name', example: 'Running' })
  name!: string;

  @ApiPropertyOptional({ description: 'Sport icon emoji', example: '🏃' })
  icon!: string | null;
}
