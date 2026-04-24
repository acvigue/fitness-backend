import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateReminderPreferenceDto {
  @ApiProperty({
    description: 'Reminder intervals in minutes before tournament start',
    example: [1440, 60],
    type: [Number],
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  intervalsMinutes!: number[];

  @ApiPropertyOptional({
    description:
      'Tournament ID for a per-tournament override. Omit for a global default applying to all tournaments.',
  })
  @IsOptional()
  @IsString()
  tournamentId?: string;
}

export class ReminderPreferenceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  tournamentId!: string | null;

  @ApiProperty({ type: [Number] })
  intervalsMinutes!: number[];

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
