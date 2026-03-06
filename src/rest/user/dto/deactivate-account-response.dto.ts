import { ApiProperty } from '@nestjs/swagger';

export class DeactivateAccountResponseDto {
  @ApiProperty({ description: 'Whether the deactivation was successful', example: true })
  success!: boolean;

  @ApiProperty({
    description: 'Human-readable message',
    example: 'Account has been deactivated',
  })
  message!: string;
}
