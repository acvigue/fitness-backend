import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import { TournamentInvitationResponseDto } from './dto/tournament-invitation-response.dto';
import {
  ApiCommonErrorResponses,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@/rest/common';
import {
  ZodValidationPipe,
  paginationSchema,
  type PaginationParams,
} from '@/rest/common/pagination';
import { TournamentService } from './tournament.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import {
  TournamentResponseDto,
  PaginatedTournamentResponseDto,
} from './dto/tournament-response.dto';
import { TournamentBracketResponseDto } from './dto/tournament-bracket-response.dto';
import { TournamentMatchResponseDto } from './dto/tournament-match-response.dto';
import { TournamentStandingsResponseDto } from './dto/tournament-standings-response.dto';
import { RecordMatchResultDto } from './dto/record-match-result.dto';
import { CreateTournamentRecapDto } from './dto/create-tournament-recap.dto';
import { TournamentRecapResponseDto } from './dto/tournament-recap-response.dto';

@ApiTags('Tournaments')
@ApiBearerAuth()
@Controller({ path: 'tournaments', version: '1' })
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a tournament (requires STAFF or ADMIN role in the organization)',
  })
  @ApiResponse({ status: 201, type: TournamentResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiCommonErrorResponses()
  create(
    @Body() dto: CreateTournamentDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentResponseDto> {
    return this.tournamentService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List all tournaments (paginated, with optional filters)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'sportId', required: false, type: String, description: 'Filter by sport ID' })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by tournament status',
    enum: ['OPEN', 'CLOSED', 'UPCOMING', 'INPROGRESS', 'COMPLETED'],
  })
  @ApiQuery({
    name: 'startAfter',
    required: false,
    type: String,
    description: 'Filter tournaments starting after this date (ISO 8601)',
  })
  @ApiQuery({
    name: 'startBefore',
    required: false,
    type: String,
    description: 'Filter tournaments starting before this date (ISO 8601)',
  })
  @ApiResponse({ status: 200, type: PaginatedTournamentResponseDto })
  @ApiCommonErrorResponses()
  findAll(
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams,
    @Query('sportId') sportId?: string,
    @Query('status') status?: string,
    @Query('startAfter') startAfter?: string,
    @Query('startBefore') startBefore?: string
  ): Promise<PaginatedTournamentResponseDto> {
    return this.tournamentService.findAll(pagination, { sportId, status, startAfter, startBefore });
  }

  @Get('search')
  @ApiOperation({ summary: 'Search tournaments by name' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: PaginatedTournamentResponseDto })
  @ApiCommonErrorResponses()
  search(
    @Query('q') query: string,
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams
  ): Promise<PaginatedTournamentResponseDto> {
    return this.tournamentService.search(query, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tournament by ID' })
  @ApiResponse({ status: 200, type: TournamentResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  findOne(@Param('id') id: string): Promise<TournamentResponseDto> {
    return this.tournamentService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a tournament (requires STAFF or ADMIN role in the organization)',
  })
  @ApiResponse({ status: 200, type: TournamentResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTournamentDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentResponseDto> {
    return this.tournamentService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a tournament (requires STAFF or ADMIN role in the organization)',
  })
  @ApiResponse({ status: 204, description: 'Tournament deleted' })
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.tournamentService.delete(id, user.sub);
  }

  // ─── Team Registration ─────────────────────────────────

  @Post(':id/teams/:teamId/join')
  @ApiOperation({ summary: 'Register a team for a tournament (team captain only)' })
  @ApiResponse({ status: 201, type: TournamentResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Only the team captain can register')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  joinTournament(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentResponseDto> {
    return this.tournamentService.joinTournament(id, teamId, user.sub);
  }

  @Delete(':id/teams/:teamId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Withdraw a team from a tournament (team captain only)' })
  @ApiResponse({ status: 204, description: 'Team withdrawn' })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Only the team captain can withdraw')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  leaveTournament(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.tournamentService.leaveTournament(id, teamId, user.sub);
  }

  @Post(':id/teams/:teamId')
  @ApiOperation({ summary: 'Add a team to a tournament (org manager only)' })
  @ApiResponse({ status: 201, type: TournamentResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  addTeam(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentResponseDto> {
    return this.tournamentService.addTeam(id, teamId, user.sub);
  }

  @Delete(':id/teams/:teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a team from a tournament (org manager only)' })
  @ApiResponse({ status: 204, description: 'Team removed' })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  removeTeam(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.tournamentService.removeTeam(id, teamId, user.sub);
  }

  // ─── Bracket & Matches ─────────────────────────────────

  @Post(':id/bracket')
  @ApiOperation({
    summary:
      'Generate single-elimination bracket with random seeding (requires STAFF or ADMIN role)',
  })
  @ApiResponse({ status: 201, type: TournamentBracketResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  generateBracket(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentBracketResponseDto> {
    return this.tournamentService.generateBracket(id, user.sub);
  }

  @Get(':id/bracket')
  @ApiOperation({ summary: 'Get the tournament bracket/matches grouped by round' })
  @ApiResponse({ status: 200, type: TournamentBracketResponseDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  getBracket(@Param('id') id: string): Promise<TournamentBracketResponseDto> {
    return this.tournamentService.getBracket(id);
  }

  @Get(':id/standings')
  @ApiOperation({ summary: 'Get round robin standings (round robin tournaments only)' })
  @ApiResponse({ status: 200, type: TournamentStandingsResponseDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  getStandings(@Param('id') id: string): Promise<TournamentStandingsResponseDto> {
    return this.tournamentService.getStandings(id);
  }

  @Post(':id/seed-bracket')
  @ApiOperation({
    summary: 'Seed single-elimination bracket from round robin standings (org manager only)',
  })
  @ApiResponse({ status: 201, type: TournamentBracketResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Requires STAFF or ADMIN role in the organization')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  seedBracketFromStandings(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentBracketResponseDto> {
    return this.tournamentService.seedBracketFromStandings(id, user.sub);
  }

  @Get(':id/recaps')
  @ApiOperation({ summary: 'List recap videos for a tournament' })
  @ApiResponse({ status: 200, type: [TournamentRecapResponseDto] })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  listRecaps(@Param('id') id: string): Promise<TournamentRecapResponseDto[]> {
    return this.tournamentService.listRecaps(id);
  }

  @Post(':id/recaps')
  @ApiOperation({ summary: 'Link a recap video to a completed tournament (org manager only)' })
  @ApiResponse({ status: 201, type: TournamentRecapResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Requires STAFF or ADMIN role in the organization')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  addRecap(
    @Param('id') id: string,
    @Body() dto: CreateTournamentRecapDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentRecapResponseDto> {
    return this.tournamentService.addRecap(id, dto.videoId, user.sub);
  }

  @Delete(':id/recaps/:recapId')
  @ApiOperation({ summary: 'Remove a recap video (org manager only)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Recap removed' })
  @ApiForbiddenResponse('Requires STAFF or ADMIN role in the organization')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  removeRecap(
    @Param('id') id: string,
    @Param('recapId') recapId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.tournamentService.removeRecap(id, recapId, user.sub);
  }

  @Patch(':id/matches/:matchId/result')
  @ApiOperation({
    summary: 'Record a match result — higher score wins (requires STAFF or ADMIN role)',
  })
  @ApiResponse({ status: 200, type: TournamentMatchResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  recordMatchResult(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: RecordMatchResultDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentMatchResponseDto> {
    return this.tournamentService.recordMatchResult(id, matchId, dto, user.sub);
  }

  @Post(':id/matches/:matchId/report')
  @ApiOperation({
    summary:
      'Report a tentative match result (team captain). Result enters PENDING_CONFIRMATION; opposing captain confirms or disputes.',
  })
  @ApiResponse({ status: 201, type: TournamentMatchResponseDto })
  @ApiForbiddenResponse('Must be captain of a participating team')
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  reportMatchResult(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: RecordMatchResultDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentMatchResponseDto> {
    return this.tournamentService.reportMatchResult(id, matchId, dto, user.sub);
  }

  @Post(':id/matches/:matchId/confirm')
  @ApiOperation({
    summary: 'Confirm a reported match score (opposing team captain). Finalizes the match.',
  })
  @ApiResponse({ status: 201, type: TournamentMatchResponseDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  confirmMatchResult(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentMatchResponseDto> {
    return this.tournamentService.confirmMatchResult(id, matchId, user.sub);
  }

  @Post(':id/matches/:matchId/dispute')
  @ApiOperation({
    summary:
      'Dispute a reported match score (opposing captain). Reverts to PENDING for staff review.',
  })
  @ApiResponse({ status: 201, type: TournamentMatchResponseDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  disputeMatchResult(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentMatchResponseDto> {
    return this.tournamentService.disputeMatchResult(id, matchId, user.sub);
  }

  @Post(':id/matches/:matchId/forfeit/:teamId')
  @ApiOperation({
    summary: 'Record a forfeit for a team — opposing team is awarded the win (STAFF/ADMIN).',
  })
  @ApiResponse({ status: 201, type: TournamentMatchResponseDto })
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  forfeitMatch(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentMatchResponseDto> {
    return this.tournamentService.forfeitMatch(id, matchId, teamId, user.sub);
  }

  // ─── Tournament Invitations ─────────────────────────────

  @Post(':id/invitations/:teamId')
  @ApiOperation({ summary: 'Invite a team to a tournament (org manager only)' })
  @ApiResponse({ status: 201, type: TournamentInvitationResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  sendTournamentInvitation(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentInvitationResponseDto> {
    return this.tournamentService.sendTournamentInvitation(id, teamId, user.sub);
  }

  @Patch('invitations/:invitationId/accept')
  @ApiOperation({ summary: 'Accept a tournament invitation (team captain only)' })
  @ApiResponse({ status: 200, type: TournamentInvitationResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Only the team captain can respond')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  acceptTournamentInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentInvitationResponseDto> {
    return this.tournamentService.respondToTournamentInvitation(invitationId, user.sub, true);
  }

  @Patch('invitations/:invitationId/decline')
  @ApiOperation({ summary: 'Decline a tournament invitation (team captain only)' })
  @ApiResponse({ status: 200, type: TournamentInvitationResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Only the team captain can respond')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  declineTournamentInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentInvitationResponseDto> {
    return this.tournamentService.respondToTournamentInvitation(invitationId, user.sub, false);
  }

  @Get(':id/invitations')
  @ApiOperation({ summary: 'List tournament invitations (org manager only)' })
  @ApiResponse({ status: 200, type: [TournamentInvitationResponseDto] })
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  getTournamentInvitations(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<TournamentInvitationResponseDto[]> {
    return this.tournamentService.getTournamentInvitations(id, user.sub);
  }
}
