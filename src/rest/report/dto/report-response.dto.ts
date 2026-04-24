import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportResponseDto {
  @ApiProperty({ description: 'Report ID', example: 'rep-123' })
  id!: string;

  @ApiProperty({ description: 'Reporter User ID', example: 'wejfe023r2343' })
  reporterId!: string;

  @ApiProperty({ description: 'Reported User ID', example: 'wejfe023r2343' })
  reportedId!: string;

  @ApiPropertyOptional({
    description: 'ID of the specific reported message, if any',
    type: String,
  })
  messageId!: string | null;

  @ApiPropertyOptional({
    description: 'Reason for report',
    example: 'They harassed me',
    type: String,
  })
  reason!: string | null;

  @ApiProperty({ description: 'Status', example: 'Banned' })
  status!: string;

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;
}
