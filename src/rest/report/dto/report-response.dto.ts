import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/rest/common/pagination';

export class ReportResponseDto {
  @ApiProperty({ description: 'Report ID', example: 'rep-123', type: String })
  id!: string;

  @ApiProperty({ description: 'Reporter User ID', example: 'wejfe023r2343', type: String })
  reporterId!: string;

  @ApiProperty({ description: 'Reported User ID', example: 'wejfe023r2343', type: String })
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

  @ApiProperty({ description: 'Status', example: 'Banned', type: String })
  status!: string;

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;
}

export class PaginatedReportResponseDto {
  @ApiProperty({ type: [ReportResponseDto] })
  data!: ReportResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
