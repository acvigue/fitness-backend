import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNameDto {
  @ApiProperty({ description: 'First name', example: 'John', type: String })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  firstName!: string;

  @ApiProperty({ description: 'Last name', example: 'Doe', type: String })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastName!: string;
}
