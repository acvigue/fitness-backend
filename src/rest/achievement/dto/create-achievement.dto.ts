import { ApiProperty } from '@nestjs/swagger';

export class CreateAchievementDto {
  @ApiProperty({ description: 'Title of Achievement', example: 'Winner of Tournament' })
  title!: string;

  @ApiProperty({ description: 'Description of Achievement', example: 'Finished 8-1' })
  description!: string;
}
