import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class TeamUpdateCaptainDto {
  @ApiProperty({ description: 'New team captain user id' })
  @IsString()
  @IsNotEmpty()
  captainId!: string;
}
