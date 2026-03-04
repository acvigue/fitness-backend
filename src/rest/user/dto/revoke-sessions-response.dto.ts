import { ApiProperty } from '@nestjs/swagger';

export class RevokeSessionsResponseDto {
  @ApiProperty({ description: 'Whether the logout was successful', example: true })
  success!: boolean;

  @ApiProperty({
    description: 'Human-readable message',
    example: 'All sessions have been revoked',
  })
  message!: string;
}
