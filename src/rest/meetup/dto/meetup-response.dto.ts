import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/rest/common/pagination';

export class MeetupResponseDto {
  @ApiProperty({ description: 'Meetup ID', example: 'clr1abc2d0000', type: String })
  id!: string;

  @ApiProperty({ description: 'Proposing team ID', type: String })
  proposingTeamId!: string;

  @ApiProperty({ description: 'Proposing team name', example: 'Team Alpha', type: String })
  proposingTeamName!: string;

  @ApiProperty({ description: 'Receiving team ID', type: String })
  receivingTeamId!: string;

  @ApiProperty({ description: 'Receiving team name', example: 'Team Beta', type: String })
  receivingTeamName!: string;

  @ApiProperty({ description: 'Meetup title', example: 'Saturday Scrimmage', type: String })
  title!: string;

  @ApiPropertyOptional({ description: 'Meetup description', type: String })
  description!: string | null;

  @ApiProperty({ description: 'Meetup location', example: 'Central Park Field 3', type: String })
  location!: string;

  @ApiProperty({ description: 'Meetup date and time', format: 'date-time', type: String })
  dateTime!: string;

  @ApiProperty({
    description: 'Meetup status',
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'],
  })
  status!: string;

  @ApiProperty({ description: 'Created timestamp', format: 'date-time', type: String })
  createdAt!: string;
}

export class PaginatedMeetupResponseDto {
  @ApiProperty({ type: [MeetupResponseDto] })
  data!: MeetupResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
