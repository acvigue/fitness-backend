import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { OidcAuthService, type AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import type { AuthenticatedRequest } from '@/rest/auth/auth.types';
import { IS_PUBLIC_KEY } from '@/rest/auth/public.decorator';
import { prisma, redis } from '@/shared/utils';

@Injectable()
export class OidcAuthGuard implements CanActivate {
  private readonly logger = new Logger(OidcAuthGuard.name);

  constructor(
    private readonly authService: OidcAuthService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket auth is handled by the gateway's handleConnection
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest | (Request & { user?: unknown })>();

    if (request.user) {
      return true;
    }

    const token = this.extractBearerToken(request);
    const user = await this.authService.verifyToken(token);

    const sessionId = user.payload.sid as string | undefined;
    if (sessionId && (await redis.exists(`session:revoked:${sessionId}`))) {
      throw new UnauthorizedException('Session has been revoked');
    }

    request.user = user;

    // Fire-and-forget: upsert user in the background
    this.syncUser(user).catch((err) =>
      this.logger.error(`Background user sync failed for ${user.sub}`, err)
    );

    return true;
  }

  private async syncUser(user: AuthenticatedUser): Promise<void> {
    await prisma.user.upsert({
      where: { id: user.sub },
      create: {
        id: user.sub,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
      update: {
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
    });
  }

  private extractBearerToken(request: Request): string {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    return authHeader.slice(7).trim();
  }
}
