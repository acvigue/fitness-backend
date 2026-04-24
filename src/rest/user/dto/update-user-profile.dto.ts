import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ description: 'User bio', example: 'Fitness enthusiast', type: String })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({
    description: 'List of sport IDs (UUIDs)',
    type: [String],
    example: ['a1b2c3d4-0001-4000-8000-000000000001'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  favoriteSportIds?: string[];

  @ApiPropertyOptional({
    description: 'List of media IDs to use as profile pictures (first is primary)',
    type: [String],
    example: ['clr1abc2d0000'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pictureIds?: string[];

  @ApiPropertyOptional({
    description: 'List of user achievement IDs to feature on profile (max 5)',
    type: [String],
    example: ['cm123abc'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  @IsOptional()
  featuredAchievementIds?: string[];
}
