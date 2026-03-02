import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserMembershipResponseDto {
  @ApiProperty({ description: 'Membership ID', example: 'clr1abc2d0000' })
  id!: string;

  @ApiProperty({ description: 'Organization ID', example: 'clr1abc2d0001' })
  organizationId!: string;

  @ApiPropertyOptional({ description: 'Organization name', example: 'Acme Corp' })
  organizationName!: string | null;

  @ApiProperty({
    description: 'Member role',
    enum: ['MEMBER', 'STAFF', 'ADMIN'],
    example: 'MEMBER',
  })
  role!: string;

  @ApiProperty({ description: 'Joined timestamp', format: 'date-time' })
  joinedAt!: Date;
}
