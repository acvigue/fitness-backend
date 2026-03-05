import { ApiProperty } from '@nestjs/swagger';

export class KeycloakSessionClientDto {
  @ApiProperty({ description: 'Client ID', example: 'account' })
  clientId!: string;

  @ApiProperty({ description: 'Client display name', example: 'Account Console' })
  clientName!: string;
}

export class KeycloakSessionResponseDto {
  @ApiProperty({ description: 'Keycloak session ID', example: 'abc123-def456-789' })
  id!: string;

  @ApiProperty({ description: 'Username associated with the session', example: 'john.doe' })
  username!: string;

  @ApiProperty({ description: 'IP address of the session', example: '192.168.1.100' })
  ipAddress!: string;

  @ApiProperty({ description: 'Session start time', example: '2025-01-01T00:00:00.000Z' })
  startedAt!: string;

  @ApiProperty({ description: 'Last access time', example: '2025-01-01T12:00:00.000Z' })
  lastAccessedAt!: string;

  @ApiProperty({
    description: 'Clients active in this session',
    type: [KeycloakSessionClientDto],
  })
  clients!: KeycloakSessionClientDto[];

  @ApiProperty({ description: 'Whether "remember me" was used', example: false })
  rememberMe!: boolean;

  @ApiProperty({ description: 'Whether this is an offline session', example: false })
  offline!: boolean;

  @ApiProperty({ description: 'Whether this session can be individually revoked', example: true })
  revocable!: boolean;

  @ApiProperty({ description: 'Whether this is the session making the request', example: false })
  thisSession!: boolean;
}
