import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponses } from '@/rest/common';
import { SportService } from './sport.service';
import { SportResponseDto } from './dto/sport-response.dto';

@ApiTags('Sports')
@ApiBearerAuth()
@Controller({ path: 'sports', version: '1' })
export class SportController {
  constructor(private readonly sportService: SportService) {}

  @Get()
  @ApiOperation({ summary: 'List all available sports' })
  @ApiResponse({ status: 200, type: [SportResponseDto] })
  @ApiCommonErrorResponses()
  findAll(): Promise<SportResponseDto[]> {
    return this.sportService.findAll();
  }
}
