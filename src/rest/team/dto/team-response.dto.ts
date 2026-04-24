import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '@/rest/user/dto/user-response.dto';

export class TeamResponseDto {
  @ApiProperty({ description: 'Team ID', example: 'cm123abc456def789ghi0001', type: String })
  id!: string;

  @ApiProperty({ description: 'Team name', example: 'Purdue Badminton A', type: String })
  name!: string;

  @ApiProperty({
    description: 'Team description',
    example: 'Competitive student badminton team',
    type: String,
  })
  description!: string;

  @ApiProperty({ description: 'Team captain user ID', type: String })
  captainId!: string;

  @ApiProperty({
    description: 'Sport ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  sportId!: string;

  @ApiProperty({ description: 'List of team members', type: () => [UserResponseDto] })
  members!: UserResponseDto[];
}
