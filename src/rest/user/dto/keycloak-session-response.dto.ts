import { ApiProperty } from '@nestjs/swagger';

export class KeycloakSessionClientDto {
  @ApiProperty({ description: 'Client ID', example: 'account', type: String })
  clientId!: string;

  @ApiProperty({ description: 'Client display name', example: 'Account Console', type: String })
  clientName!: string;
}

export class KeycloakSessionResponseDto {
  @ApiProperty({ description: 'Keycloak session ID', example: 'abc123-def456-789', type: String })
  id!: string;

  @ApiProperty({
    description: 'Username associated with the session',
    example: 'john.doe',
    type: String,
  })
  username!: string;

  @ApiProperty({ description: 'IP address of the session', example: '192.168.1.100', type: String })
  ipAddress!: string;

  @ApiProperty({
    description: 'Session start time',
    example: '2025-01-01T00:00:00.000Z',
    type: String,
  })
  startedAt!: string;

  @ApiProperty({
    description: 'Last access time',
    example: '2025-01-01T12:00:00.000Z',
    type: String,
  })
  lastAccessedAt!: string;

  @ApiProperty({
    description: 'Clients active in this session',
    type: [KeycloakSessionClientDto],
  })
  clients!: KeycloakSessionClientDto[];

  @ApiProperty({ description: 'Whether "remember me" was used', example: false, type: Boolean })
  rememberMe!: boolean;

  @ApiProperty({ description: 'Whether this is an offline session', example: false, type: Boolean })
  offline!: boolean;

  @ApiProperty({
    description: 'Whether this session can be individually revoked',
    example: true,
    type: Boolean,
  })
  revocable!: boolean;

  @ApiProperty({
    description: 'Whether this is the session making the request',
    example: false,
    type: Boolean,
  })
  thisSession!: boolean;
}
