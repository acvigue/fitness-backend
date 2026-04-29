import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationInvitationStatus, OrganizationRole } from '@/generated/prisma/enums';

export class OrganizationInvitationResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  organizationId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  organizationName!: string | null;

  @ApiProperty({ type: String })
  invitedUserId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  invitedUserName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  invitedUserUsername!: string | null;

  @ApiProperty({ type: String })
  invitedById!: string;

  @ApiProperty({ enum: OrganizationRole })
  role!: keyof typeof OrganizationRole;

  @ApiProperty({ enum: OrganizationInvitationStatus })
  status!: keyof typeof OrganizationInvitationStatus;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}
