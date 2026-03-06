import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ description: 'ID of the user being reported', example: 'user-abc123' })
  @IsString()
  @IsNotEmpty()
  reportedId!: string;

  @ApiPropertyOptional({ description: 'Reason for the report', example: 'Inappropriate behavior' })
  @IsString()
  @IsOptional()
  reason?: string;
}
