import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserProfileResponseDto } from '@/rest/user/dto/user-profile-response.dto';
import { PaginationMetaDto } from '@/rest/common/pagination';

export class OrganizationMemberListItemDto {
  @ApiProperty({ description: 'User ID', example: 'auth0|507f1f77bcf86cd799439011', type: String })
  userId!: string;

  @ApiPropertyOptional({ description: 'Username', example: 'john.doe', type: String })
  username!: string | null;

  @ApiPropertyOptional({ description: 'Full name', example: 'John Doe', type: String })
  name!: string | null;

  @ApiPropertyOptional({ description: 'Email address', example: 'john@example.com', type: String })
  email!: string | null;

  @ApiProperty({ description: 'Member role', enum: ['MEMBER', 'STAFF', 'ADMIN'] })
  role!: string;

  @ApiProperty({
    description: 'Date the user joined the organization',
    format: 'date-time',
    type: String,
  })
  joinedAt!: string;
}

export class PaginatedOrganizationMemberListDto {
  @ApiProperty({ type: [OrganizationMemberListItemDto] })
  data!: OrganizationMemberListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class OrganizationMemberProfileResponseDto {
  @ApiProperty({ description: 'User ID', example: 'auth0|507f1f77bcf86cd799439011', type: String })
  userId!: string;

  @ApiPropertyOptional({ description: 'Username', example: 'john.doe', type: String })
  username!: string | null;

  @ApiPropertyOptional({ description: 'Full name', example: 'John Doe', type: String })
  name!: string | null;

  @ApiPropertyOptional({ description: 'Email address', example: 'john@example.com', type: String })
  email!: string | null;

  @ApiProperty({ description: 'Member role', enum: ['MEMBER', 'STAFF', 'ADMIN'] })
  role!: string;

  @ApiProperty({
    description: 'Date the user joined the organization',
    format: 'date-time',
    type: String,
  })
  joinedAt!: string;

  @ApiProperty({ description: 'Full user profile', type: () => UserProfileResponseDto })
  profile!: UserProfileResponseDto;
}
