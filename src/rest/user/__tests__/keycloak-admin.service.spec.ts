import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  InternalServerErrorException,
  NotFoundException,
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';

const ISSUER = 'https://sso.example.com/realms/test';
const CLIENT_ID = 'test-admin';
const CLIENT_SECRET = 'test-secret';

function setEnv() {
  process.env.OIDC_ISSUER = ISSUER;
  process.env.KEYCLOAK_ADMIN_CLIENT_ID = CLIENT_ID;
  process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = CLIENT_SECRET;
}

function clearEnv() {
  delete process.env.OIDC_ISSUER;
  delete process.env.KEYCLOAK_ADMIN_CLIENT_ID;
  delete process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;
}

function mockFetchResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `STATUS_${status}`,
    json: () => Promise.resolve(body),
  } as Response;
}

function tokenResponse(expiresIn = 300) {
  return mockFetchResponse(200, {
    access_token: 'admin-token',
    expires_in: expiresIn,
    token_type: 'Bearer',
  });
}

describe('KeycloakAdminService', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setEnv();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    clearEnv();
    vi.restoreAllMocks();
  });

  async function createService() {
    const { KeycloakAdminService } = await import('../keycloak-admin.service');
    return new KeycloakAdminService();
  }

  // ─── constructor ────────────────────────────────────

  describe('constructor', () => {
    it('should throw when OIDC_ISSUER is missing', async () => {
      delete process.env.OIDC_ISSUER;
      await expect(createService()).rejects.toThrow('OIDC_ISSUER environment variable is required');
    });

    it('should throw when admin client credentials are missing', async () => {
      delete process.env.KEYCLOAK_ADMIN_CLIENT_ID;
      delete process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;
      await expect(createService()).rejects.toThrow(
        'KEYCLOAK_ADMIN_CLIENT_ID and KEYCLOAK_ADMIN_CLIENT_SECRET'
      );
    });

    it('should throw when OIDC_ISSUER does not match realm pattern', async () => {
      process.env.OIDC_ISSUER = 'https://sso.example.com/bad-format';
      await expect(createService()).rejects.toThrow('OIDC_ISSUER must match pattern');
    });

    it('should construct successfully with valid env', async () => {
      const service = await createService();
      expect(service).toBeDefined();
    });
  });

  // ─── getUserSessions ────────────────────────────────

  describe('getUserSessions', () => {
    it('should fetch token then fetch sessions', async () => {
      const sessions = [
        {
          id: 'sess-1',
          username: 'john',
          userId: 'user-1',
          ipAddress: '10.0.0.1',
          start: 1704067200,
          lastAccess: 1704110400,
          clients: { account: 'Account' },
          transientUser: false,
          rememberMe: false,
        },
      ];

      fetchSpy
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(mockFetchResponse(200, sessions));

      const service = await createService();
      const result = await service.getUserSessions('user-1');

      expect(result).toEqual(sessions);

      // Verify token request
      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        `${ISSUER}/protocol/openid-connect/token`,
        expect.objectContaining({ method: 'POST' })
      );

      // Verify sessions request
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        `https://sso.example.com/admin/realms/test/users/user-1/sessions`,
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bearer admin-token' },
        })
      );
    });

    it('should return empty array when response is 204', async () => {
      fetchSpy.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(mockFetchResponse(204));

      const service = await createService();
      const result = await service.getUserSessions('user-1');

      expect(result).toEqual([]);
    });

    it('should cache the admin token across calls', async () => {
      fetchSpy
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(mockFetchResponse(200, []))
        .mockResolvedValueOnce(mockFetchResponse(200, []));

      const service = await createService();
      await service.getUserSessions('user-1');
      await service.getUserSessions('user-1');

      // Token fetched only once, sessions fetched twice
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls[0][0]).toContain('/token');
      expect(fetchSpy.mock.calls[1][0]).toContain('/sessions');
      expect(fetchSpy.mock.calls[2][0]).toContain('/sessions');
    });
  });

  // ─── deleteSession ────────────────────────────────────

  describe('deleteSession', () => {
    it('should send DELETE to the correct URL', async () => {
      fetchSpy.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(mockFetchResponse(204));

      const service = await createService();
      await service.deleteSession('sess-1');

      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://sso.example.com/admin/realms/test/sessions/sess-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should throw NotFoundException on 404', async () => {
      fetchSpy.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(mockFetchResponse(404));

      const service = await createService();
      await expect(service.deleteSession('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── logoutAllSessions ────────────────────────────────

  describe('logoutAllSessions', () => {
    it('should send POST to the correct URL', async () => {
      fetchSpy.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(mockFetchResponse(204));

      const service = await createService();
      await service.logoutAllSessions('user-1');

      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://sso.example.com/admin/realms/test/users/user-1/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  // ─── error handling ────────────────────────────────────

  describe('error handling', () => {
    it('should throw InternalServerErrorException when token fetch fails', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(401));

      const service = await createService();
      await expect(service.getUserSessions('user-1')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on 401 from admin API', async () => {
      fetchSpy.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(mockFetchResponse(401));

      const service = await createService();
      await expect(service.getUserSessions('user-1')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on 403 from admin API', async () => {
      fetchSpy.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(mockFetchResponse(403));

      const service = await createService();
      await expect(service.getUserSessions('user-1')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw BadGatewayException on 500 from admin API', async () => {
      fetchSpy.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(mockFetchResponse(500));

      const service = await createService();
      await expect(service.getUserSessions('user-1')).rejects.toThrow(BadGatewayException);
    });

    it('should throw ServiceUnavailableException on network error during token fetch', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const service = await createService();
      await expect(service.getUserSessions('user-1')).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw ServiceUnavailableException on network error during admin request', async () => {
      fetchSpy
        .mockResolvedValueOnce(tokenResponse())
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const service = await createService();
      await expect(service.getUserSessions('user-1')).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
