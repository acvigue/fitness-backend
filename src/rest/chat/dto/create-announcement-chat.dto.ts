import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { OrganizationRole } from '@/generated/prisma/client';

export class CreateAnnouncementChatDto {
  @ApiProperty({
    description: 'Organization ID this announcement channel belongs to',
    example: 'clr1abc2d0000',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({
    description: 'Announcement channel name',
    example: 'General Announcements',
    maxLength: 100,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Organization roles allowed to post messages',
    example: ['STAFF', 'ADMIN'],
    enum: OrganizationRole,
    isArray: true,
  })
  @IsArray()
  @IsEnum(OrganizationRole, { each: true })
  @ArrayMinSize(1)
  writeRoles!: OrganizationRole[];

  @ApiPropertyOptional({
    description:
      'Specific member user IDs to include. If omitted, all organization members are added.',
    example: ['user-id-1', 'user-id-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  memberIds?: string[];
}
