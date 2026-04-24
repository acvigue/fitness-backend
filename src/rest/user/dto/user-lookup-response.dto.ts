import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserLookupItemDto {
  @ApiProperty({ description: 'User ID', example: 'auth0|507f1f77bcf86cd799439011', type: String })
  id!: string;

  @ApiPropertyOptional({ description: 'Username', example: 'john.doe', type: String })
  username!: string | null;

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe', type: String })
  name!: string | null;

  @ApiPropertyOptional({ description: 'First name', example: 'John', type: String })
  firstName!: string | null;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe', type: String })
  lastName!: string | null;

  @ApiPropertyOptional({ description: 'Email address', example: 'john@example.com', type: String })
  email!: string | null;
}

export class UserLookupResponseDto {
  @ApiProperty({ type: [UserLookupItemDto], description: 'Matching users' })
  users!: UserLookupItemDto[];
}
