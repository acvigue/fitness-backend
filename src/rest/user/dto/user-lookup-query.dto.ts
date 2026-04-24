import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class UserLookupQueryDto {
  @ApiProperty({
    description: 'Search term to look up users by email, name, or username',
    example: 'john',
    minLength: 2,
    maxLength: 100,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  q!: string;
}
