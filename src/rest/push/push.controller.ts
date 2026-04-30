import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { Public } from '@/rest/auth/public.decorator';
import { CurrentUser } from '@/shared/current-user.decorator';
import { ApiCommonErrorResponses, ApiNotFoundResponse } from '@/rest/common';
import { ZodValidationPipe } from '@/rest/common/pagination';
import { PushService } from './push.service';
import { WebPushProvider } from './webpush.provider';
import {
  PushDeviceResponseDto,
  PushPreferencesResponseDto,
  RegisterPushDeviceDto,
  UpdatePushPreferencesDto,
  VapidPublicKeyResponseDto,
  registerPushDeviceSchema,
  updatePushPreferencesSchema,
  type RegisterPushDeviceInput,
  type UpdatePushPreferencesInput,
} from './dto';

@ApiTags('Push')
@Controller({ path: 'push', version: '1' })
export class PushController {
  constructor(
    private readonly pushService: PushService,
    private readonly webpush: WebPushProvider
  ) {}

  @Public()
  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Fetch the VAPID public key for Web Push subscription' })
  @ApiResponse({ status: 200, type: VapidPublicKeyResponseDto })
  getVapidPublicKey(): VapidPublicKeyResponseDto {
    return { publicKey: this.webpush.getPublicKey() ?? '' };
  }

  @ApiBearerAuth()
  @Get('devices')
  @ApiOperation({ summary: "List the current user's push devices" })
  @ApiResponse({ status: 200, type: [PushDeviceResponseDto] })
  @ApiCommonErrorResponses()
  listDevices(@CurrentUser() user: AuthenticatedUser): Promise<PushDeviceResponseDto[]> {
    return this.pushService.listDevices(user.sub);
  }

  @ApiBearerAuth()
  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a push device for the current user' })
  @ApiBody({ type: RegisterPushDeviceDto })
  @ApiResponse({ status: 201, type: PushDeviceResponseDto })
  @ApiCommonErrorResponses()
  registerDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(registerPushDeviceSchema))
    body: RegisterPushDeviceInput
  ): Promise<PushDeviceResponseDto> {
    return this.pushService.registerDevice(user.sub, body);
  }

  @ApiBearerAuth()
  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister a push device' })
  @ApiResponse({ status: 204 })
  @ApiNotFoundResponse()
  @ApiCommonErrorResponses()
  unregisterDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<void> {
    return this.pushService.unregisterDevice(user.sub, id);
  }

  @ApiBearerAuth()
  @Get('preferences')
  @ApiOperation({ summary: 'Get push notification type preferences' })
  @ApiResponse({ status: 200, type: PushPreferencesResponseDto })
  @ApiCommonErrorResponses()
  getPreferences(@CurrentUser() user: AuthenticatedUser): Promise<PushPreferencesResponseDto> {
    return this.pushService.getPreferences(user.sub);
  }

  @ApiBearerAuth()
  @Put('preferences')
  @ApiOperation({ summary: 'Update push notification type preferences' })
  @ApiBody({ type: UpdatePushPreferencesDto })
  @ApiResponse({ status: 200, type: PushPreferencesResponseDto })
  @ApiCommonErrorResponses()
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updatePushPreferencesSchema))
    body: UpdatePushPreferencesInput
  ): Promise<PushPreferencesResponseDto> {
    return this.pushService.updatePreferences(user.sub, body);
  }
}
