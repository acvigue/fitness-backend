import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { SessionService } from './session.service';
import { OidcAuthGuard } from '../auth/oidc.guard';
import { CurrentUser } from '@/shared/current-user.decorator';

@Controller('sessions')
@UseGuards(OidcAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  async getSessions(@CurrentUser() user: { sub: string }) {
    return this.sessionService.getSessions(user.sub);
  }

  @Post(':id/revoke')
  async revokeSession(@Param('id') sessionId: string, @CurrentUser() user: { sub: string }) {
    return this.sessionService.revokeSession(sessionId, user.sub);
  }
}
