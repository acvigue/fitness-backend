import { Controller, Get, Patch, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import {
  ApiCommonErrorResponses,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@/rest/common';
import { TeamService } from './team.service';
import { TeamResponseDto } from './dto/team-response.dto';
import { TeamUpdateCaptainDto } from './dto/team-update.dto';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller({ path: 'teams', version: '1' })
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'List all available teams' })
  @ApiResponse({ status: 200, type: [TeamResponseDto] })
  @ApiCommonErrorResponses()
  findAll(): Promise<TeamResponseDto[]> {
    return this.teamService.findAll();
  }
  
  @Patch(:id)
  @ApiOperation({ summary: 'Change team captain (current captain only)' })
  @ApiResponse({ status: 200, type: TeamResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('You are not the current team captain')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  updateCaptain(
    @Param('id') id: string,
	@Body() dto: TeamUpdateCaptainDto
	@CurrentUser() user: AuthenticatedUser
  ) : Promise<TeamResponseDto> {
	return this.teamService.updateCaptain(id, dto, user.sub)
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
