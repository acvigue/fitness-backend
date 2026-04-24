import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTournamentRecapDto {
  @ApiProperty({ description: 'ID of an existing video to link as the recap' })
  @IsString()
  @IsNotEmpty()
  videoId!: string;
}
