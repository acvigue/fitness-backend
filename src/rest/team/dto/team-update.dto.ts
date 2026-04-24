import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class TeamUpdateDto {
  @ApiProperty({ description: 'Team name', example: 'Purdue Badminton A', type: String })
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
    description: 'Team description',
    example: 'Updated description',
    required: false,
    type: String,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
