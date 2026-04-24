import { ApiProperty } from '@nestjs/swagger';

export class OrganizationMemberResponseDto {
  @ApiProperty({ description: 'Membership ID', type: String })
  id!: string;

  @ApiProperty({ description: 'User ID', type: String })
  userId!: string;

  @ApiProperty({ description: 'Organization ID', type: String })
  organizationId!: string;

  @ApiProperty({ description: 'Member role', enum: ['MEMBER', 'STAFF', 'ADMIN'] })
  role!: string;

  @ApiProperty({ description: 'Joined timestamp', format: 'date-time' })
  createdAt!: Date;
}
