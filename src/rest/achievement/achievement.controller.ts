import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiCommonErrorResponses, ApiBadRequestResponse } from '@/rest/common';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { AchievementService } from './achievement.service';
import { CreateAchievementDefinitionDto } from './dto/create-achievement-definition.dto';
import { AchievementDefinitionResponseDto } from './dto/achievement-definition-response.dto';
import { UserAchievementResponseDto } from './dto/user-achievement-response.dto';

@ApiTags('Achievements')
@ApiBearerAuth()
@Controller({ path: 'achievements', version: '1' })
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Post('definitions')
  @ApiOperation({ summary: 'Create an achievement definition' })
  @ApiResponse({ status: 201, type: AchievementDefinitionResponseDto })
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  createDefinition(
    @Body() dto: CreateAchievementDefinitionDto
  ): Promise<AchievementDefinitionResponseDto> {
    return this.achievementService.createDefinition(dto);
  }

  @Get('definitions')
  @ApiOperation({ summary: 'List all achievement definitions' })
  @ApiResponse({ status: 200, type: [AchievementDefinitionResponseDto] })
  @ApiCommonErrorResponses()
  listDefinitions(): Promise<AchievementDefinitionResponseDto[]> {
    return this.achievementService.listDefinitions();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get all achievements with progress for current user' })
  @ApiResponse({ status: 200, type: [UserAchievementResponseDto] })
  @ApiCommonErrorResponses()
  getMyAchievements(@CurrentUser() user: AuthenticatedUser): Promise<UserAchievementResponseDto[]> {
    return this.achievementService.getAllAchievementsForUser(user.sub);
  }

  @Get('me/earned')
  @ApiOperation({ summary: 'Get only earned (unlocked) achievements for current user' })
  @ApiResponse({ status: 200, type: [UserAchievementResponseDto] })
  @ApiCommonErrorResponses()
  getMyEarnedAchievements(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<UserAchievementResponseDto[]> {
    return this.achievementService.getUserAchievements(user.sub);
  }

  @Get('me/locked')
  @ApiOperation({ summary: 'Get only locked (not yet earned) achievements for current user' })
  @ApiResponse({ status: 200, type: [UserAchievementResponseDto] })
  @ApiCommonErrorResponses()
  getMyLockedAchievements(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<UserAchievementResponseDto[]> {
    return this.achievementService.getLockedAchievements(user.sub);
  }
}
