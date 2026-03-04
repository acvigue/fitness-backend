import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';

export class CreateChatDto {
  @ApiProperty({
    description:
      'List of user IDs to include in the chat (excluding the creator, who is auto-added)',
    example: ['user-id-1', 'user-id-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @ArrayMinSize(1)
  recipientIds!: string[];

  @ApiPropertyOptional({
    description: 'Chat name (required for group chats with 2+ recipients, ignored for 1-to-1)',
    example: 'Gym Buddies',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
