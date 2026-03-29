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
import { TeamService } from './team.service';
import { TeamCreateDto } from './dto/team-create.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { TeamUpdateCaptainDto } from './dto/team-update-captain.dto';
import { TeamUpdateDto } from './dto/team-update.dto';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller({ path: 'teams', version: '1' })
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @ApiOperation({ summary: 'Create a team and assign creator as captain' })
  @ApiResponse({ status: 201, type: TeamResponseDto })
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  create(
    @Body() dto: TeamCreateDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamResponseDto> {
    return this.teamService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List all available teams' })
  @ApiResponse({ status: 200, type: [TeamResponseDto] })
  @ApiCommonErrorResponses()
  findAll(): Promise<TeamResponseDto[]> {
    return this.teamService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public team profile' })
  @ApiResponse({ status: 200, type: TeamResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  findOne(@Param('id') id: string): Promise<TeamResponseDto> {
    return this.teamService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update team settings (captain only)' })
  @ApiResponse({ status: 200, type: TeamResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('You are not the current team captain')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  update(
    @Param('id') id: string,
    @Body() dto: TeamUpdateDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamResponseDto> {
    return this.teamService.update(id, dto, user.sub);
  }

  @Patch(':id/captain')
  @ApiOperation({ summary: 'Change team captain (current captain only)' })
  @ApiResponse({ status: 200, type: TeamResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('You are not the current team captain')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  updateCaptain(
    @Param('id') id: string,
    @Body() dto: TeamUpdateCaptainDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TeamResponseDto> {
    return this.teamService.updateCaptain(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a team (current captain only)' })
  @ApiResponse({ status: 204, description: 'Team deleted' })
  @ApiForbiddenResponse('You are not the current team captain')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.teamService.delete(id, user.sub);
  }
}
