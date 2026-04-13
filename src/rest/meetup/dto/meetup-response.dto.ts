import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MeetupResponseDto {
  @ApiProperty({ description: 'Meetup ID', example: 'clr1abc2d0000' })
  id!: string;

  @ApiProperty({ description: 'Proposing team ID' })
  proposingTeamId!: string;

  @ApiProperty({ description: 'Proposing team name', example: 'Team Alpha' })
  proposingTeamName!: string;

  @ApiProperty({ description: 'Receiving team ID' })
  receivingTeamId!: string;

  @ApiProperty({ description: 'Receiving team name', example: 'Team Beta' })
  receivingTeamName!: string;

  @ApiProperty({ description: 'Meetup title', example: 'Saturday Scrimmage' })
  title!: string;

  @ApiPropertyOptional({ description: 'Meetup description' })
  description!: string | null;

  @ApiProperty({ description: 'Meetup location', example: 'Central Park Field 3' })
  location!: string;

  @ApiProperty({ description: 'Meetup date and time', format: 'date-time' })
  dateTime!: string;

  @ApiProperty({
    description: 'Meetup status',
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'],
  })
  status!: string;

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: string;
}
