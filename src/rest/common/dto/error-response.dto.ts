import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
    type: Number,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Error type/code',
    example: 'BAD_REQUEST',
    type: String,
  })
  error!: string;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'Invalid request parameters',
    type: String,
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Detailed validation errors or additional context',
    type: 'array',
    items: { type: 'string' },
    example: ['field must be a string', 'value is required'],
  })
  details?: string[];

  @ApiPropertyOptional({
    description: 'Request path that caused the error',
    example: '/v1/resource/abc123',
    type: String,
  })
  path?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when the error occurred',
    example: '2025-12-26T12:00:00.000Z',
    type: String,
  })
  timestamp?: string;
}
