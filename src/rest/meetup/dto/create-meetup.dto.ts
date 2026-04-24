import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMeetupDto {
  @ApiProperty({ description: 'ID of the proposing team', example: 'clr1abc2d0000', type: String })
  @IsString()
  @IsNotEmpty()
  proposingTeamId!: string;

  @ApiProperty({ description: 'ID of the receiving team', example: 'clr1abc2d0001', type: String })
  @IsString()
  @IsNotEmpty()
  receivingTeamId!: string;

  @ApiProperty({
    description: 'Meetup title',
    example: 'Saturday Scrimmage',
    maxLength: 200,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    description: 'Meetup description',
    example: 'Friendly match at the park',
    maxLength: 2000,
    type: String,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Meetup location', example: 'Central Park Field 3', type: String })
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty({
    description: 'Meetup date and time (ISO 8601)',
    example: '2026-05-01T14:00:00.000Z',
    type: String,
  })
  @IsDateString()
  dateTime!: string;
}
