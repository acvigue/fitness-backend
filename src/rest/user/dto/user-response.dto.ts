import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'User subject identifier from the identity provider',
    example: 'auth0|507f1f77bcf86cd799439011',
    type: String,
  })
  sub!: string;

  @ApiPropertyOptional({
    description: 'Username or preferred username',
    example: 'john.doe',
    type: String,
  })
  username?: string;

  @ApiPropertyOptional({
    description: 'Full name of the user',
    example: 'John Doe',
    type: String,
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'First name of the user',
    example: 'John',
    type: String,
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name of the user',
    example: 'Doe',
    type: String,
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
    type: String,
    format: 'email',
  })
  email?: string;

  @ApiProperty({
    description: 'List of user scopes/permissions',
    example: ['read', 'write'],
    type: [String],
    isArray: true,
  })
  scopes!: string[];
}
