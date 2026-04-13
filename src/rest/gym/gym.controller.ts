import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GymService } from './gym.service';
import { CreateGymDto } from './dto/create-gym.dto';

@ApiTags('Gyms')
@Controller({ path: 'gyms', version: '1' })
export class GymController {
  constructor(private readonly gymService: GymService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new gym' })
  create(@Body() createGymDto: CreateGymDto) {
    return this.gymService.create(createGymDto);
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
  @ApiOperation({ summary: 'Get one gym by ID' })
  findOne(@Param('id') id: string) {
    return this.gymService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a gym' })
  update(@Param('id') id: string, @Body() updateGymDto: Partial<CreateGymDto>) {
    return this.gymService.update(id, updateGymDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a gym' })
  remove(@Param('id') id: string) {
    return this.gymService.remove(id);
  }
}
