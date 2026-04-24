import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({
    description: 'ID of the user being reported',
    example: 'user-abc123',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  reportedId!: string;

  @ApiPropertyOptional({
    description: 'ID of the specific offending message (optional)',
    example: 'msg-abc123',
    type: String,
  })
  @IsString()
  @IsOptional()
  messageId?: string;

  @ApiPropertyOptional({
    description: 'Reason for the report',
    example: 'Inappropriate behavior',
    type: String,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
