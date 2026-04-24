import { ApiProperty } from '@nestjs/swagger';

export class DeactivateAccountResponseDto {
  @ApiProperty({
    description: 'Whether the deactivation was successful',
    example: true,
    type: Boolean,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Human-readable message',
    example: 'Account has been deactivated',
    type: String,
  })
  message!: string;
}
