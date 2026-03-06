import { ApiProperty } from '@nestjs/swagger';

export class SearchMessageHitDto {
  @ApiProperty({ description: 'Message ID', example: 'clr1abc2d0001' })
  id!: string;

  @ApiProperty({ description: 'Message content', example: 'Hey, want to work out today?' })
  content!: string;

  @ApiProperty({ description: 'Sender display name or username', example: 'John Doe' })
  senderName!: string;

  @ApiProperty({ description: 'Sender user ID', example: 'auth0|507f1f77bcf86cd799439011' })
  senderId!: string;

  @ApiProperty({ description: 'Timestamp when the message was sent', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({
    description: 'Zero-based index of this message in the full history (ordered by createdAt DESC)',
    example: 127,
  })
  index!: number;

  @ApiProperty({
    description: 'Page number where this message appears (based on per_page)',
    example: 3,
  })
  page!: number;
}

export class SearchMessagesResponseDto {
  @ApiProperty({ type: [SearchMessageHitDto] })
  hits!: SearchMessageHitDto[];

  @ApiProperty({ description: 'Total number of matching messages', example: 5 })
  total!: number;
}
