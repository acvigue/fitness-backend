import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountResponseDto {
  @ApiProperty({ description: 'Whether the deletion was successful', example: true })
  success!: boolean;

  @ApiProperty({
    description: 'Human-readable message',
    example: 'Account has been permanently deleted',
  })
  message!: string;
}
