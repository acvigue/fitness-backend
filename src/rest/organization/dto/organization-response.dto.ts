import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/rest/common/pagination';

export class OrganizationResponseDto {
  @ApiProperty({ description: 'Organization ID', example: 'clr1abc2d0000', type: String })
  id!: string;

  @ApiPropertyOptional({ description: 'Organization name', example: 'Acme Corp', type: String })
  name!: string | null;

  @ApiProperty({ description: 'Number of members', example: 5, type: Number })
  memberCount!: number;

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp', format: 'date-time' })
  updatedAt!: Date;
}

export class PaginatedOrganizationResponseDto {
  @ApiProperty({ type: [OrganizationResponseDto] })
  data!: OrganizationResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
