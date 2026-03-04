import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ description: 'Chat ID to send the message to', example: 'clr1abc2d0000' })
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @ApiProperty({ description: 'Message content', example: 'Hey, want to work out today?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
