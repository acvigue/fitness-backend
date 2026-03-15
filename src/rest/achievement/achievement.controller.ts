import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiCommonErrorResponses, ApiBadRequestResponse, ApiNotFoundResponse } from '@/rest/common';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { AchievementService } from './achievement.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import type { AchievementDto } from '~/rest/achievement/dto/achievement.dto';

@ApiTags('Achievement')
@ApiBearerAuth()
@Controller({ path: 'Achievement', version: '1' })
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}
  @Post()
  @ApiOperation({ summary: 'Creates Achievement' })
  @ApiResponse({ status: 201, type: CreateAchievementDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  create(
    @Body() dto: CreateAchievementDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<CreateAchievementDto> {
    return this.achievementService.create(dto, user.sub);
  }
  @Get()
  @ApiOperation({ summary: 'Gets all Achievements a User Has' })
  get(@CurrentUser() user: AuthenticatedUser): Promise<AchievementDto[]> {
    return this.achievementService.get(user.sub);
  }
}
