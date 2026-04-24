import { ApiProperty } from '@nestjs/swagger';
import { VideoResponseDto } from '@/rest/video/dto/video-response.dto';

export class TournamentRecapResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  tournamentId!: string;

  @ApiProperty({ type: String })
  uploadedById!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ type: VideoResponseDto })
  video!: VideoResponseDto;
}
