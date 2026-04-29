import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/rest/common/pagination';

export class ModerationMessageResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  chatId!: string;

  @ApiProperty({ type: String })
  senderId!: string;

  @ApiProperty({ type: String })
  content!: string;

  @ApiProperty({ type: String })
  type!: string;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  hiddenAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;
}

export class PaginatedModerationMessageResponseDto {
  @ApiProperty({ type: [ModerationMessageResponseDto] })
  data!: ModerationMessageResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
