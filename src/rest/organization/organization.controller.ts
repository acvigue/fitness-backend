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
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  OrganizationResponseDto,
  PaginatedOrganizationResponseDto,
} from './dto/organization-response.dto';
import { OrganizationMemberResponseDto } from './dto/organization-member-response.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller({ path: 'organizations', version: '1' })
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, type: OrganizationResponseDto })
  @ApiBadRequestResponse()
  @ApiCommonErrorResponses()
  create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationResponseDto> {
    return this.organizationService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: PaginatedOrganizationResponseDto })
  @ApiCommonErrorResponses()
  findAll(
    @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams
  ): Promise<PaginatedOrganizationResponseDto> {
    return this.organizationService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an organization by ID' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  findOne(@Param('id') id: string): Promise<OrganizationResponseDto> {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization (STAFF or ADMIN only)' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse('Insufficient role — requires STAFF or ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationResponseDto> {
    return this.organizationService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an organization (ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Organization deleted' })
  @ApiForbiddenResponse('Insufficient role — requires ADMIN')
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.organizationService.delete(id, user.sub);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join an organization as MEMBER' })
  @ApiResponse({ status: 201, type: OrganizationMemberResponseDto })
  @ApiNotFoundResponse()
  @ApiResponse({ status: 409, description: 'Already a member' })
  @ApiCommonErrorResponses()
  join(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<OrganizationMemberResponseDto> {
    return this.organizationService.join(id, user.sub);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave an organization' })
  @ApiResponse({ status: 204, description: 'Left the organization' })
  @ApiNotFoundResponse('Not a member of this organization')
  @ApiCommonErrorResponses()
  leave(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.organizationService.leave(id, user.sub);
  }
}
