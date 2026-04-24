import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Organization name', example: 'Acme Corp', type: String })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
