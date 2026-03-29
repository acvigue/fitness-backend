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
}
