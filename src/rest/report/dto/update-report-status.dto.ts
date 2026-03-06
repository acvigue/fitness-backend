import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export class UpdateReportStatusDto {
  @ApiProperty({ description: 'Report ID', example: 'clr1abc2d0000' })
  @IsString()
  @IsNotEmpty()
  reportId!: string;

  @ApiProperty({ description: 'New status', enum: ReportStatus, example: 'REVIEWED' })
  @IsEnum(ReportStatus)
  status!: ReportStatus;
}
