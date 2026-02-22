import { ApiProperty } from '@nestjs/swagger';

export class OrganizationMemberResponseDto {
  @ApiProperty({ description: 'Membership ID' })
  id!: string;

  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Organization ID' })
  organizationId!: string;

  @ApiProperty({ description: 'Member role', enum: ['MEMBER', 'STAFF', 'ADMIN'] })
  role!: string;

  @ApiProperty({ description: 'Joined timestamp', format: 'date-time' })
  createdAt!: Date;
}
