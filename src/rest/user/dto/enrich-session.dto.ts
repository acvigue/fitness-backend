import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class EnrichSessionDto {
  @ApiProperty({ description: 'The refresh token for the current session' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class EnrichSessionResponseDto {
  @ApiProperty({ description: 'Whether the session was enriched', example: true })
  success!: boolean;

  @ApiProperty({ description: 'The session ID that was enriched', example: 'abc123-def456' })
  sessionId!: string;
}
