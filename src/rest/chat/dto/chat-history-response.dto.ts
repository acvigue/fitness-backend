import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/rest/common/pagination';
import { MessageResponseDto } from './message-response.dto';

export class ChatHistoryResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  data!: MessageResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
