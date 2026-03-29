import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { JWKS_PROVIDER } from '@/rest/auth/auth.constants';
import { TestTokenIssuer, TEST_ISSUER, TEST_AUDIENCE } from './test-token-issuer';

vi.mock('@/shared/utils', () => ({
  prisma: {
    user: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
  redis: {},
  redisSub: {},
}));

// Dynamic imports after mock is registered
const { OidcAuthGuard } = await import('@/rest/auth/oidc.guard');
const { OidcAuthService } = await import('@/rest/auth/oidc-auth.service');
const { prisma } = await import('@/shared/utils');

function createMockContext(
  request: Record<string, unknown> & { headers: Record<string, string> },
  _isPublic = false
): { context: ExecutionContext; reflectorSpy: null } {
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => () => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;

  return { context, reflectorSpy: null };
}

describe('OidcAuthGuard', () => {
  let guard: InstanceType<typeof OidcAuthGuard>;
  let issuer: TestTokenIssuer;
  let reflector: Reflector;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    issuer = await TestTokenIssuer.create();

    process.env.OIDC_ISSUER = TEST_ISSUER;
    process.env.OIDC_AUDIENCE = TEST_AUDIENCE;

    const module = await Test.createTestingModule({
      providers: [
        { provide: JWKS_PROVIDER, useValue: issuer.jwks },
        OidcAuthService,
        OidcAuthGuard,
        Reflector,
      ],
    }).compile();

    guard = module.get(OidcAuthGuard);
    reflector = module.get(Reflector);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow access to @Public() routes without a token', async () => {
    const { context } = createMockContext({ headers: {} });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when request.user is already set', async () => {
    const { context } = createMockContext({
      headers: {},
      user: { sub: 'existing-user' },
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should authenticate a valid bearer token and set request.user', async () => {
    const token = await issuer.issueToken();
    const request: Record<string, unknown> & { headers: Record<string, string> } = {
      headers: { authorization: `Bearer ${token}` },
    };
    const { context } = createMockContext(request);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toBeDefined();
    expect((request.user as Record<string, unknown>).sub).toBe('test-user-id');
  });

  it('should set correct user properties on request.user', async () => {
    const token = await issuer.issueToken({
      sub: 'user-123',
      email: 'user@test.com',
      name: 'Test User',
      preferred_username: 'tester',
      scope: 'openid profile',
    });
    const request: Record<string, unknown> & { headers: Record<string, string> } = {
      headers: { authorization: `Bearer ${token}` },
    };
    const { context } = createMockContext(request);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    await guard.canActivate(context);

    const user = request.user as Record<string, unknown>;
    expect(user.sub).toBe('user-123');
    expect(user.email).toBe('user@test.com');
    expect(user.name).toBe('Test User');
    expect(user.username).toBe('tester');
    expect(user.scopes).toEqual(['openid', 'profile']);
  });

  it('should throw UnauthorizedException when Authorization header is missing', async () => {
    const { context } = createMockContext({ headers: {} });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when Authorization header is not Bearer', async () => {
    const { context } = createMockContext({
      headers: { authorization: 'Basic abc123' },
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for an expired token', async () => {
    const token = await issuer.issueExpiredToken();
    const { context } = createMockContext({
      headers: { authorization: `Bearer ${token}` },
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should call prisma.user.upsert to sync user after authentication', async () => {
    const token = await issuer.issueToken({
      sub: 'sync-user-id',
      email: 'sync@test.com',
      name: 'Sync User',
      given_name: 'Sync',
      family_name: 'User',
      preferred_username: 'syncuser',
    });
    const request: Record<string, unknown> & { headers: Record<string, string> } = {
      headers: { authorization: `Bearer ${token}` },
    };
    const { context } = createMockContext(request);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    await guard.canActivate(context);

    // Give the fire-and-forget promise a tick to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: 'sync-user-id' },
      create: {
        id: 'sync-user-id',
        email: 'sync@test.com',
        name: 'Sync User',
        firstName: 'Sync',
        lastName: 'User',
        username: 'syncuser',
      },
      update: {
        email: 'sync@test.com',
        name: 'Sync User',
        firstName: 'Sync',
        lastName: 'User',
        username: 'syncuser',
      },
    });
  });

  it('should not throw when syncUser fails (fire-and-forget)', async () => {
    (prisma.user.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('DB connection failed')
    );

    const token = await issuer.issueToken();
    const request: Record<string, unknown> & { headers: Record<string, string> } = {
      headers: { authorization: `Bearer ${token}` },
    };
    const { context } = createMockContext(request);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });
});
