import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadGatewayException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import type { KeycloakTokenResponse, KeycloakSessionRaw } from './keycloak-admin.types';

@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private readonly tokenEndpoint: string;
  private readonly adminBaseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor() {
    const issuer = process.env.OIDC_ISSUER;
    this.clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? '';
    this.clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET ?? '';

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

  private async adminRequest<T>(method: string, path: string): Promise<T | null> {
    const token = await this.getAdminToken();

    let response: Response;
    try {
      response = await fetch(`${this.adminBaseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      throw new ServiceUnavailableException('Cannot reach identity provider');
    }

    if (response.status === 204 || response.status === 205) {
      return null;
    }

    if (response.status === 404) {
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

    return (await response.json()) as T;
  }

  async getUserSessions(userId: string): Promise<KeycloakSessionRaw[]> {
    const sessions = await this.adminRequest<KeycloakSessionRaw[]>(
      'GET',
      `/users/${userId}/sessions`
    );
    return sessions ?? [];
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.adminRequest('DELETE', `/sessions/${sessionId}`);
  }

  async logoutAllSessions(userId: string): Promise<void> {
    await this.adminRequest('POST', `/users/${userId}/logout`);
  }
}
