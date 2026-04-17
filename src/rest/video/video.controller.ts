import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import {
  ApiBadRequestResponse,
  ApiCommonErrorResponses,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@/rest/common';
import { VideoService } from './video.service';
import { VideoCreateDto } from './dto/video-create.dto';
import { VideoResponseDto } from './dto/video-response.dto';
import { VideoUpdateDto } from './dto/video-update.dto';


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
  @ApiResponse({ status: 200, type: [VideoResponseDto] })
  @ApiCommonErrorResponses()
  findAll(): Promise<VideoResponseDto[]> {
    return this.videoService.findAll();
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
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ warning?: string }> {
    return this.videoService.delete(id, user.sub);
  }
