import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeeklyAvailabilityRuleDto } from './create-gym.dto';
import { GymAvailabilityExceptionResponseDto } from './gym-schedule.dto';

export class GymResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  location!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  capacity!: number | null;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: String })
  organizationId!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  updatedAt!: string;
}

export class GymWithRulesResponseDto extends GymResponseDto {
  @ApiProperty({ type: [WeeklyAvailabilityRuleDto] })
  availabilityRules!: WeeklyAvailabilityRuleDto[];
}

export class GymDetailResponseDto extends GymWithRulesResponseDto {
  @ApiProperty({ type: [GymAvailabilityExceptionResponseDto] })
  availabilityExceptions!: GymAvailabilityExceptionResponseDto[];
}
