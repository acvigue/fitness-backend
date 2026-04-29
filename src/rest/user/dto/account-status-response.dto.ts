import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RestrictionAction } from '@/generated/prisma/enums';

export const ACCOUNT_STATUS_VALUES = ['ACTIVE', 'SUSPENDED', 'BANNED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUS_VALUES)[number];

export class ActiveRestrictionDto {
  @ApiProperty({ enum: RestrictionAction })
  action!: keyof typeof RestrictionAction;

  @ApiProperty({ format: 'date-time', type: String })
  endsAt!: string;

  @ApiProperty({ type: String })
  reason!: string;
}

export class AccountStatusResponseDto {
  @ApiProperty({
    enum: ACCOUNT_STATUS_VALUES,
    description:
      'Overall account status. ACTIVE means the user can use the app normally; SUSPENDED is time-bounded; BANNED is permanent until revoked.',
  })
  status!: AccountStatus;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'When a SUSPENDED account becomes active again (ISO 8601). Null otherwise.',
    format: 'date-time',
  })
  suspendedUntil!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  reason!: string | null;

  @ApiProperty({
    type: [ActiveRestrictionDto],
    description: 'Active per-action restrictions, even when the overall status is ACTIVE.',
  })
  restrictions!: ActiveRestrictionDto[];
}
