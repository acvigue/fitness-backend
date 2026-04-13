import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTeamMessageDto {
  @ApiProperty({ description: 'Message content', example: 'Hey team, want to scrimmage?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({
    description: 'Media attachment IDs',
    example: ['media-id-1'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaIds?: string[];
}
