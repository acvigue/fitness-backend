import { ApiProperty } from '@nestjs/swagger';

export class UserProfilePictureDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ required: false })
  alt?: string;

  @ApiProperty()
  isPrimary: boolean;
}

export class UserProfileResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ required: false })
  bio?: string;

  @ApiProperty({ type: [String] })
  favoriteSports: string[];

  @ApiProperty({ type: [UserProfilePictureDto] })
  pictures: UserProfilePictureDto[];
}
