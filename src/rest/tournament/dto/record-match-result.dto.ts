import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecordMatchResultDto {
  @ApiProperty({ description: 'Score for team 1', example: 3, type: Number })
  @IsInt()
  @Min(0)
  team1Score!: number;

  @ApiProperty({ description: 'Score for team 2', example: 1, type: Number })
  @IsInt()
  @Min(0)
  team2Score!: number;
}
