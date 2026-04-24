import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GymService } from './gym.service';
import { CreateGymDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';

@ApiTags('Gyms')
@ApiBearerAuth()
@Controller({ path: 'gyms', version: '1' })
export class GymController {
  constructor(private readonly gymService: GymService) {}

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
}
