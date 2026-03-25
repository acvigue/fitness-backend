import { ApiProperty } from '@nestjs/swagger';

export class TeamUpdateCaptainDto {
  @ApiProperty({ description: 'Team Captain' })
  captainId!: string;
}
