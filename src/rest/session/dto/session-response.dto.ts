import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ description: 'Session ID', example: 'clrsess123456' })
  id!: string;

  @ApiProperty({ description: 'User ID', example: 'clruser123456' })
  userId!: string;

  @ApiPropertyOptional({ description: 'IP address of the session', example: '192.168.1.1' })
  ipAddress?: string | null;

  @ApiPropertyOptional({ description: 'User agent of the session', example: 'Chrome 112' })
  userAgent?: string | null;

  @ApiPropertyOptional({
    description: 'Approximate location of the session',
    example: 'New York, USA',
  })
  location?: string | null;

  @ApiProperty({ description: 'Whether the session is active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Timestamp when the session was created', format: 'date-time' })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the session was revoked',
    format: 'date-time',
  })
  revokedAt?: Date | null;
}
