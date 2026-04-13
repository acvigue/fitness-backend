import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGymDto {
  @ApiProperty({
    description: 'Gym name',
    example: 'Corec Main Gym',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Organization ID that owns this gym',
    example: 'clr1abc2d0000',
  })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiPropertyOptional({
    description: 'Gym description',
    example: 'Main basketball and volleyball court',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Gym location',
    example: 'Building A, Floor 1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({
    description: 'Maximum recommended capacity',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Whether the gym is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
