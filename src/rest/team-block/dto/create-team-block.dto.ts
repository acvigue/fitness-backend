import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTeamBlockDto {
  @ApiProperty({ description: 'ID of the team to block', example: 'clr1abc2d0000', type: String })
  @IsString()
  @IsNotEmpty()
  blockedTeamId!: string;
}
