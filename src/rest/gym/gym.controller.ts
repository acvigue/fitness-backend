import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GymService } from './gym.service';
import { GymSubscriptionService, GymSubscriptionResponseDto } from './gym-subscription.service';
import { CreateGymDto, WeeklyAvailabilityRuleDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';
import { GymSlotResponseDto } from './dto/gym-slot.dto';
import {
  CreateClosureDto,
  CreateExceptionDto,
  CreateReservationDto,
  EffectiveAvailabilityQueryDto,
  EffectiveSlotDto,
  GymAvailabilityExceptionResponseDto,
  ReplaceRulesDto,
} from './dto/gym-schedule.dto';
import {
  GymDetailResponseDto,
  GymResponseDto,
  GymWithRulesResponseDto,
} from './dto/gym-response.dto';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import {
  ApiCommonErrorResponses,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@/rest/common';

@ApiTags('Gyms')
@ApiBearerAuth()
@Controller({ path: 'gyms', version: '1' })
export class GymController {
  constructor(
    private readonly gymService: GymService,
    private readonly subscriptionService: GymSubscriptionService
  ) {}

  // ---------------------------------------------------------------------------
  // Gym CRUD
  // ---------------------------------------------------------------------------

  @Post()
  @ApiOperation({ summary: 'Create a new gym (org STAFF/ADMIN)' })
  @ApiResponse({ status: 201, type: GymDetailResponseDto })
  @ApiForbiddenResponse('Only organization staff or admins can create a gym')
  @ApiCommonErrorResponses()
  create(
    @Body() createGymDto: CreateGymDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<GymDetailResponseDto> {
    return this.gymService.create(
      createGymDto,
      user.sub
    ) as unknown as Promise<GymDetailResponseDto>;
  }

  @Get()
  @ApiOperation({ summary: 'List gyms, optionally filtered by organization' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiResponse({ status: 200, type: [GymWithRulesResponseDto] })
  findAll(@Query('organizationId') organizationId?: string): Promise<GymWithRulesResponseDto[]> {
    if (organizationId) {
      return this.gymService.findByOrganization(organizationId) as unknown as Promise<
        GymWithRulesResponseDto[]
      >;
    }
    return this.gymService.findAll() as unknown as Promise<GymWithRulesResponseDto[]>;
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List the current user’s watched gyms' })
  @ApiResponse({ status: 200, type: [GymSubscriptionResponseDto] })
  @ApiCommonErrorResponses()
  listSubscriptions(@CurrentUser() user: AuthenticatedUser): Promise<GymSubscriptionResponseDto[]> {
    return this.subscriptionService.listForUser(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one gym including weekly rules and exceptions' })
  @ApiResponse({ status: 200, type: GymDetailResponseDto })
  @ApiNotFoundResponse()
  findOne(@Param('id') id: string): Promise<GymDetailResponseDto> {
    return this.gymService.findOne(id) as unknown as Promise<GymDetailResponseDto>;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update gym metadata and (optionally) replace weekly rules (STAFF/ADMIN)',
  })
  @ApiResponse({ status: 200, type: GymDetailResponseDto })
  @ApiForbiddenResponse('Only organization staff or admins can edit this gym')
  @ApiCommonErrorResponses()
  update(
    @Param('id') id: string,
    @Body() updateGymDto: UpdateGymDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<GymDetailResponseDto> {
    return this.gymService.update(
      id,
      updateGymDto,
      user.sub
    ) as unknown as Promise<GymDetailResponseDto>;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a gym (STAFF/ADMIN)' })
  @ApiResponse({ status: 200, type: GymResponseDto })
  @ApiForbiddenResponse('Only organization staff or admins can delete this gym')
  @ApiCommonErrorResponses()
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<GymResponseDto> {
    return this.gymService.remove(id, user.sub) as unknown as Promise<GymResponseDto>;
  }

  // ---------------------------------------------------------------------------
  // Effective availability — merged rules + exceptions + concrete slots
  // ---------------------------------------------------------------------------

  @Get(':id/effective-availability')
  @ApiOperation({
    summary:
      'Compute effective availability for a gym over a date range. Merges weekly rules, date-specific exceptions, and concrete reservations/closures into a flat sorted list of segments.',
  })
  @ApiResponse({ status: 200, type: [EffectiveSlotDto] })
  @ApiBadRequestResponse('Invalid date range')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  effectiveAvailability(
    @Param('id') gymId: string,
    @Query() query: EffectiveAvailabilityQueryDto
  ): Promise<EffectiveSlotDto[]> {
    return this.gymService.findEffectiveAvailability(gymId, query);
  }

  // ---------------------------------------------------------------------------
  // Reservations (team captain creates / cancels)
  // ---------------------------------------------------------------------------

  @Post(':id/reservations')
  @ApiOperation({ summary: 'Reserve a gym window for a team (team captain only)' })
  @ApiResponse({ status: 201, type: GymSlotResponseDto })
  @ApiForbiddenResponse('Only the team captain can reserve a gym slot')
  @ApiNotFoundResponse()
  @ApiBadRequestResponse('Window outside gym’s open hours or overlaps an existing slot')
  @ApiCommonErrorResponses()
  createReservation(
    @Param('id') gymId: string,
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<GymSlotResponseDto> {
    return this.gymService.createReservation(gymId, dto, user.sub);
  }

  @Delete(':id/reservations/:slotId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Cancel a reservation (reserving team captain or org staff/admin)',
  })
  @ApiForbiddenResponse('Only the reserving team captain or org staff can cancel')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  async cancelReservation(
    @Param('id') gymId: string,
    @Param('slotId') slotId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    await this.gymService.cancelReservation(gymId, slotId, user.sub);
  }

  // ---------------------------------------------------------------------------
  // Closures (org staff manually closes a window)
  // ---------------------------------------------------------------------------

  @Post(':id/closures')
  @ApiOperation({ summary: 'Manually close a gym window (STAFF/ADMIN)' })
  @ApiResponse({ status: 201, type: GymSlotResponseDto })
  @ApiForbiddenResponse('Only organization staff or admins can close a gym window')
  @ApiNotFoundResponse()
  @ApiBadRequestResponse('Window overlaps an existing slot')
  @ApiCommonErrorResponses()
  createClosure(
    @Param('id') gymId: string,
    @Body() dto: CreateClosureDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<GymSlotResponseDto> {
    return this.gymService.createClosure(gymId, dto, user.sub);
  }

  @Delete(':id/closures/:slotId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a closure (STAFF/ADMIN)' })
  @ApiForbiddenResponse('Only organization staff or admins can remove a closure')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  async removeClosure(
    @Param('id') gymId: string,
    @Param('slotId') slotId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    await this.gymService.removeClosure(gymId, slotId, user.sub);
  }

  // ---------------------------------------------------------------------------
  // Schedule management (rules + exceptions)
  // ---------------------------------------------------------------------------

  @Put(':id/rules')
  @ApiOperation({ summary: 'Replace the weekly schedule rules (STAFF/ADMIN)' })
  @ApiResponse({ status: 200, type: [WeeklyAvailabilityRuleDto] })
  @ApiForbiddenResponse('Only organization staff or admins can edit rules')
  @ApiCommonErrorResponses()
  replaceRules(
    @Param('id') gymId: string,
    @Body() dto: ReplaceRulesDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<WeeklyAvailabilityRuleDto[]> {
    return this.gymService.replaceRules(gymId, dto, user.sub) as unknown as Promise<
      WeeklyAvailabilityRuleDto[]
    >;
  }

  @Post(':id/exceptions')
  @ApiOperation({ summary: 'Add a date-specific schedule exception (STAFF/ADMIN)' })
  @ApiResponse({ status: 201, type: GymAvailabilityExceptionResponseDto })
  @ApiForbiddenResponse('Only organization staff or admins can add exceptions')
  @ApiCommonErrorResponses()
  createException(
    @Param('id') gymId: string,
    @Body() dto: CreateExceptionDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<GymAvailabilityExceptionResponseDto> {
    return this.gymService.createException(gymId, dto, user.sub);
  }

  @Delete(':id/exceptions/:exceptionId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a schedule exception (STAFF/ADMIN)' })
  @ApiForbiddenResponse('Only organization staff or admins can remove exceptions')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  async removeException(
    @Param('id') gymId: string,
    @Param('exceptionId') exceptionId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    await this.gymService.removeException(gymId, exceptionId, user.sub);
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  @Post(':id/subscribe')
  @ApiOperation({ summary: 'Subscribe to gym availability alerts' })
  @ApiResponse({ status: 201, type: GymSubscriptionResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  subscribe(
    @Param('id') gymId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<GymSubscriptionResponseDto> {
    return this.subscriptionService.subscribe(user.sub, gymId);
  }

  @Delete(':id/subscribe')
  @HttpCode(204)
  @ApiOperation({ summary: 'Unsubscribe from gym availability alerts' })
  @ApiResponse({ status: 204, description: 'Unsubscribed' })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  async unsubscribe(
    @Param('id') gymId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    await this.subscriptionService.unsubscribe(user.sub, gymId);
  }
}
