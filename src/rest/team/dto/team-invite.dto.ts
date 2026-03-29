import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TeamInviteDto {
  @ApiProperty({ description: 'User ID to invite', example: 'user-123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userId!: string;
}
