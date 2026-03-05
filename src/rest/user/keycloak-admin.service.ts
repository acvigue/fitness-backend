import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadGatewayException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { redis } from '@/shared/utils';
import type {
  KeycloakTokenResponse,
  KeycloakSessionRaw,
  KeycloakSessionTagged,
} from './keycloak-admin.types';

@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private readonly tokenEndpoint: string;
  private readonly revocationEndpoint: string;
  private readonly adminBaseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly publicClientId: string;
  private readonly publicClientUuid: string;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor() {
    const issuer = process.env.OIDC_ISSUER;
    this.clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? '';
    this.clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET ?? '';
    this.publicClientId = process.env.OIDC_CLIENT_ID ?? 'fittime-app';
    this.publicClientUuid = process.env.OIDC_CLIENT_UUID ?? '92b50814-4527-4cf6-a202-1c05ea579305';

    if (!issuer) {
      throw new Error('OIDC_ISSUER environment variable is required');
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'KEYCLOAK_ADMIN_CLIENT_ID and KEYCLOAK_ADMIN_CLIENT_SECRET environment variables are required'
      );
    }

    const match = issuer.match(/^(.+)\/realms\/([^/]+)$/);
    if (!match) {
      throw new Error(`OIDC_ISSUER must match pattern {base}/realms/{realm}, got: ${issuer}`);
    }

    const [, baseUrl, realm] = match;
    this.tokenEndpoint = `${issuer}/protocol/openid-connect/token`;
    this.revocationEndpoint = `${issuer}/protocol/openid-connect/revoke`;
    this.adminBaseUrl = `${baseUrl}/admin/realms/${realm}`;
  }

  private async getAdminToken(): Promise<string> {
    if (this.cachedToken && this.tokenExpiresAt > Date.now() + 30_000) {
      return this.cachedToken;
    }

    let response: Response;
    try {
      response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });
    } catch {
      throw new ServiceUnavailableException('Cannot reach identity provider');
    }

    if (!response.ok) {
      this.logger.error(`Failed to obtain admin token: ${response.status} ${response.statusText}`);
      throw new InternalServerErrorException('Keycloak admin authentication failed');
    }

    const data = (await response.json()) as KeycloakTokenResponse;
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return this.cachedToken;
  }

  private async adminRequest<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T | null> {
    const token = await this.getAdminToken();

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(`${this.adminBaseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      this.logger.error(`Failed to reach Keycloak admin endpoint: ${method} ${path}`);
      throw new ServiceUnavailableException('Cannot reach identity provider');
    }

    if (response.status === 204 || response.status === 205) {
      this.logger.debug(`Keycloak admin request successful: ${method} ${path} - No Content`);
      return null;
    }

    if (response.status === 404) {
      this.logger.warn(`Keycloak admin resource not found: ${method} ${path}`);
      throw new NotFoundException('Session not found');
    }

    if (response.status === 401 || response.status === 403) {
      this.logger.error(`Keycloak admin request denied: ${response.status} ${response.statusText}`);
      throw new InternalServerErrorException('Keycloak admin insufficient permissions');
    }

    if (!response.ok) {
      this.logger.error(`Keycloak admin request failed: ${response.status} ${response.statusText}`);
      throw new BadGatewayException('Identity provider returned an error');
    }

    const data = (await response.json()) as T;
    this.logger.debug(`Keycloak admin request successful: ${method} ${path}`);
    return data;
  }

  async getUserSessions(userId: string): Promise<KeycloakSessionTagged[]> {
    const [sessions, offlineSessions] = await Promise.all([
      this.adminRequest<KeycloakSessionRaw[]>('GET', `/users/${userId}/sessions`),
      this.adminRequest<KeycloakSessionRaw[]>(
        'GET',
        `/users/${userId}/offline-sessions/${this.publicClientUuid}`
      ),
    ]);

    return [
      ...(sessions ?? []).map((s) => ({ ...s, offline: false })),
      ...(offlineSessions ?? []).map((s) => ({ ...s, offline: true })),
    ];
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.adminRequest('DELETE', `/sessions/${sessionId}`);
    await this.blacklistSession(sessionId);
  }

  async revokeSessionByToken(sessionId: string): Promise<void> {
    const refreshToken = await redis.get(`session:rt:${sessionId}`);
    if (!refreshToken) {
      throw new NotFoundException('No refresh token stored for this session');
    }

    let response: Response;
    try {
      response = await fetch(this.revocationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.publicClientId,
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }),
      });
    } catch {
      throw new ServiceUnavailableException('Cannot reach identity provider');
    }

    if (!response.ok) {
      this.logger.error(`Token revocation failed: ${response.status} ${response.statusText}`);
      throw new BadGatewayException('Failed to revoke session');
    }

    await redis.del(`session:rt:${sessionId}`);
    await this.blacklistSession(sessionId);
  }

  async blacklistSession(sessionId: string): Promise<void> {
    // TTL matches max access token lifetime — after that, the token is expired anyway
    await redis.set(`session:revoked:${sessionId}`, '1', 'EX', 30 * 60);
  }

  async isSessionRevoked(sessionId: string): Promise<boolean> {
    return (await redis.exists(`session:revoked:${sessionId}`)) === 1;
  }

  async storeRefreshToken(sessionId: string, refreshToken: string): Promise<void> {
    // Store with 30-day TTL (matching typical offline session lifespan)
    await redis.set(`session:rt:${sessionId}`, refreshToken, 'EX', 30 * 24 * 60 * 60);
  }

  async hasRefreshToken(sessionId: string): Promise<boolean> {
    return (await redis.exists(`session:rt:${sessionId}`)) === 1;
  }

  async logoutAllSessions(userId: string): Promise<void> {
    await this.adminRequest('POST', `/users/${userId}/logout`);
  }

  async disableUser(userId: string): Promise<void> {
    await this.adminRequest('PUT', `/users/${userId}`, { enabled: false });
  }

  async enableUser(userId: string): Promise<void> {
    await this.adminRequest('PUT', `/users/${userId}`, { enabled: true });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.adminRequest('DELETE', `/users/${userId}`);
  }
}
