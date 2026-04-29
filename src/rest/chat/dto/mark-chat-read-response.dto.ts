import { ApiProperty } from '@nestjs/swagger';

export class MarkChatReadResponseDto {
  @ApiProperty({
    type: Number,
    description: 'Number of messages flipped from unread to read by this call.',
  })
  markedCount!: number;
}
