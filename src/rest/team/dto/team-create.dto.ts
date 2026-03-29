import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class TeamCreateDto {
  @ApiProperty({ description: 'Team name', example: 'Purdue Badminton A' })
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
    description: 'Team description',
    example: 'Competitive student badminton team',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
