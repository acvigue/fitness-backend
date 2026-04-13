import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTeamChatDto {
  @ApiProperty({ description: 'ID of the initiating team', example: 'clr1abc2d0000' })
  @IsString()
  @IsNotEmpty()
  fromTeamId!: string;

  @ApiProperty({ description: 'ID of the target team', example: 'clr1abc2d0001' })
  @IsString()
  @IsNotEmpty()
  toTeamId!: string;
}
