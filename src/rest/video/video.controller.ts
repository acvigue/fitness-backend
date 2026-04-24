import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import {
  ApiBadRequestResponse,
  ApiCommonErrorResponses,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@/rest/common';
import {
  ZodValidationPipe,
  paginationSchema,
  type PaginationParams,
} from '@/rest/common/pagination';
import { VideoService } from './video.service';
import { VideoCreateDto } from './dto/video-create.dto';
import { VideoResponseDto, PaginatedVideoResponseDto } from './dto/video-response.dto';
import { VideoUpdateDto } from './dto/video-update.dto';
import { UpdateVideoProgressDto, VideoProgressResponseDto } from './dto/video-progress.dto';

@ApiTags('Videos')
@ApiBearerAuth()
@Controller({ path: 'videos', version: '1' })
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post()
  @ApiOperation({ summary: 'Create a video and assign creator as captain' })
  @ApiResponse({ status: 201, type: VideoResponseDto })
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  create(
    @Body() dto: VideoCreateDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VideoResponseDto> {
    return this.videoService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List all available videos' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'sportId', required: false, type: String, description: 'Filter by sport ID' })
  @ApiResponse({ status: 200, type: PaginatedVideoResponseDto })
  @ApiCommonErrorResponses()
  findAll(
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams,
    @Query('sportId') sportId?: string
  ): Promise<PaginatedVideoResponseDto> {
    return this.videoService.findAll(pagination, { sportId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get video' })
  @ApiResponse({ status: 200, type: VideoResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  findOne(@Param('id') id: string): Promise<VideoResponseDto> {
    return this.videoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update video (uploader only)' })
  @ApiResponse({ status: 200, type: VideoResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('You are not the video uploader')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  update(
    @Param('id') id: string,
    @Body() dto: VideoUpdateDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VideoResponseDto> {
    return this.videoService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a video (uploader only)' })
  @ApiResponse({
    status: 200,
    description: 'Video deleted',
  })
  @ApiForbiddenResponse('You are not the video uploader')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.videoService.delete(id, user.sub);
  }

  @Post(':id/progress')
  @ApiOperation({ summary: 'Record or update playback progress for a video' })
  @ApiResponse({ status: 200, type: VideoProgressResponseDto })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  updateProgress(
    @Param('id') id: string,
    @Body() dto: UpdateVideoProgressDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VideoProgressResponseDto> {
    return this.videoService.updateProgress(id, user.sub, dto);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Get the current user’s playback progress for a video' })
  @ApiResponse({ status: 200, type: VideoProgressResponseDto })
  @ApiCommonErrorResponses()
  getProgress(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VideoProgressResponseDto> {
    return this.videoService.getProgress(id, user.sub);
  }
}
