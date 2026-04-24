import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsArray } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Chat ID to send the message to',
    example: 'clr1abc2d0000',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hey, want to work out today?',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({
    description: 'List of media asset IDs to attach (uploaded via /v1/utils/media-upload)',
    example: ['cm1abc123def456'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];
}
