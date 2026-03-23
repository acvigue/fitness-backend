import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TeamResponseDto {
  @ApiProperty({ description: 'Team ID (UUID)', example: 'a1b2c3d4-0001-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'Team name', example: 'Best Team Ever' })
  name!: string;
  
  @ApiProperty({ description: 'Team description', example: 'Best Team Ever' })
  description!: string;
  
  @ApiProperty({ description: 'Team captain ID (UUID)' })
  captainId!: string;
}
