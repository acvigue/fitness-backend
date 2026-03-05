import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/shared/utils';
import { uploadToR2 } from '@/shared/s3';
import type { MediaUploadResponseDto } from './dto/media-upload-response.dto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

@Injectable()
export class UtilsService {
  async uploadMedia(file: Express.Multer.File, userId: string): Promise<MediaUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds the 10 MB limit`);
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`
      );
    }

    const uuid = randomUUID();
    const ext = file.originalname.split('.').pop() || 'bin';
    const key = `fittime/assets/${uuid}.${ext}`;

    const url = await uploadToR2(key, file.buffer, file.mimetype);

    const media = await prisma.media.create({
      data: {
        id: uuid,
        userId,
        key,
        url,
        mimeType: file.mimetype,
        size: file.size,
      },
    });

    return {
      id: media.id,
      url: media.url,
      mimeType: media.mimeType,
      size: media.size,
    };
  }
}
