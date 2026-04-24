import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'Organization name', example: 'Acme Corp', type: String })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;
}
