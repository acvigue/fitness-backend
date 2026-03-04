import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserLookupItemDto {
  @ApiProperty({ description: 'User ID', example: 'auth0|507f1f77bcf86cd799439011' })
  id!: string;

  @ApiPropertyOptional({ description: 'Username', example: 'john.doe' })
  username!: string | null;

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
  name!: string | null;

  @ApiPropertyOptional({ description: 'Email address', example: 'john@example.com' })
  email!: string | null;
}

export class UserLookupResponseDto {
  @ApiProperty({ type: [UserLookupItemDto], description: 'Matching users' })
  users!: UserLookupItemDto[];
}
