import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, ArrayMinSize, MaxLength } from 'class-validator';
import { OrganizationRole } from '@/generated/prisma/client';

export class UpdateAnnouncementChatDto {
  @ApiPropertyOptional({
    description: 'Updated channel name',
    example: 'Important Announcements',
    maxLength: 100,
    type: String,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated roles allowed to post messages',
    example: ['ADMIN'],
    enum: OrganizationRole,
    isArray: true,
  })
  @IsArray()
  @IsEnum(OrganizationRole, { each: true })
  @ArrayMinSize(1)
  @IsOptional()
  writeRoles?: OrganizationRole[];
}
