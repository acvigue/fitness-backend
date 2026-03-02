import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportResponseDto {
  @ApiProperty({ description: 'Reporter User ID', example: 'wejfe023r2343' })
  reporterId!: string;

  @ApiProperty({ description: 'Reported User ID', example: 'wejfe023r2343' })
  reportedId!: string;

  @ApiPropertyOptional({ description: 'Reason For Report', example: 'They Harassed Me' })
  reason!: string | null;

  @ApiProperty({ description: 'Status', example: 'Banned' })
  status!: string;

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;
}
