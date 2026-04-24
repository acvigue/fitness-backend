import { ApiProperty } from '@nestjs/swagger';
import { VideoResponseDto } from '@/rest/video/dto/video-response.dto';

export class TournamentRecapResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tournamentId!: string;

  @ApiProperty()
  uploadedById!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: VideoResponseDto })
  video!: VideoResponseDto;
}
