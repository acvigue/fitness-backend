import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { OrganizationRole } from '@/generated/prisma/enums';

export class CreateOrganizationInvitationDto {
  @ApiProperty({ description: 'User to invite (must already exist in the system).', type: String })
  @IsString()
  @IsNotEmpty()
  invitedUserId!: string;

  @ApiProperty({
    enum: OrganizationRole,
    description:
      'Role the invitee will receive on accept. STAFF/ADMIN may only be granted by an existing ADMIN.',
  })
  @IsEnum(OrganizationRole)
  role!: keyof typeof OrganizationRole;
}
