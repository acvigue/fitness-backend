import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GymService } from './gym.service';
import { GymSubscriptionService } from './gym-subscription.service';
import { CreateGymDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';
import {
  CreateGymSlotDto,
  GymAvailabilityQueryDto,
  GymSlotResponseDto,
  UpdateGymSlotStatusDto,
} from './dto/gym-slot.dto';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { ApiCommonErrorResponses, ApiNotFoundResponse, ApiForbiddenResponse } from '@/rest/common';

@ApiTags('Gyms')
@ApiBearerAuth()
@Controller({ path: 'gyms', version: '1' })
export class GymController {
  constructor(
    private readonly gymService: GymService,
    private readonly subscriptionService: GymSubscriptionService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new gym with optional recurring weekly rules' })
  create(@Body() createGymDto: CreateGymDto, @CurrentUser() user: AuthenticatedUser) {
    return this.gymService.create(createGymDto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Get all gyms' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Filter gyms by organization ID',
  })
  findAll(@Query('organizationId') organizationId?: string) {
    if (organizationId) {
      return this.gymService.findByOrganization(organizationId);
    }

    return this.gymService.findAll();
  }

  @Get('availability')
  @ApiOperation({ summary: 'Query gym slot availability by gym, date range, or status' })
  @ApiResponse({ status: 200, type: [GymSlotResponseDto] })
  @ApiCommonErrorResponses()
  listAvailability(@Query() query: GymAvailabilityQueryDto): Promise<GymSlotResponseDto[]> {
    return this.gymService.listSlots(query);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List the current user’s watched gyms' })
  @ApiCommonErrorResponses()
  listSubscriptions(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionService.listForUser(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one gym by ID including recurring weekly rules' })
  findOne(@Param('id') id: string) {
    return this.gymService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a gym and optionally replace recurring weekly rules' })
  update(
    @Param('id') id: string,
    @Body() updateGymDto: UpdateGymDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.gymService.update(id, updateGymDto, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a gym' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.gymService.remove(id, user.sub);
  }

  @Post(':id/slots')
  @ApiOperation({ summary: 'Create an availability slot for a gym (org member only)' })
  @ApiResponse({ status: 201, type: GymSlotResponseDto })
  @ApiForbiddenResponse('You are not a member of this gym’s organization')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  createSlot(
    @Param('id') gymId: string,
    @Body() dto: CreateGymSlotDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<GymSlotResponseDto> {
    return this.gymService.createSlot(gymId, dto, user.sub);
  }

  @Patch(':id/slots/:slotId/status')
  @ApiOperation({ summary: 'Update a gym slot status (team captain only)' })
  @ApiResponse({ status: 200, type: GymSlotResponseDto })
  @ApiForbiddenResponse('Only team captains can update slot status')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  updateSlotStatus(
    @Param('id') gymId: string,
    @Param('slotId') slotId: string,
    @Body() dto: UpdateGymSlotStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<GymSlotResponseDto> {
    return this.gymService.updateSlotStatus(gymId, slotId, dto, user.sub);
  }

  @Post(':id/subscribe')
  @ApiOperation({ summary: 'Subscribe to gym availability alerts' })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  subscribe(@Param('id') gymId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionService.subscribe(user.sub, gymId);
  }

  @Delete(':id/subscribe')
  @ApiOperation({ summary: 'Unsubscribe from gym availability alerts' })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  unsubscribe(@Param('id') gymId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionService.unsubscribe(user.sub, gymId);
  }
}
