import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { ApiCommonErrorResponses } from '@/rest/common/decorators/api-error-responses.decorator';
import { UtilsService } from './utils.service';
import { MediaUploadResponseDto } from './dto/media-upload-response.dto';

@ApiTags('Utils')
@ApiBearerAuth()
@Controller({ path: 'utils', version: '1' })
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}

  @Post('media-upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload a media file (image or video) to R2 storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image or video file (max 10 MB)' },
      },
    },
  })
  @ApiResponse({ status: 201, type: MediaUploadResponseDto, description: 'File uploaded successfully' })
  @ApiCommonErrorResponses()
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MediaUploadResponseDto> {
    return this.utilsService.uploadMedia(file, user.sub);
  }
}
