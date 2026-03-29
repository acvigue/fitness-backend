import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OidcAuthService } from '@/rest/auth/oidc-auth.service';
import { JWKS_PROVIDER } from '@/rest/auth/auth.constants';
import { TestTokenIssuer, TEST_ISSUER, TEST_AUDIENCE } from './test-token-issuer';

describe('OidcAuthService', () => {
  let service: OidcAuthService;
  let issuer: TestTokenIssuer;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    issuer = await TestTokenIssuer.create();

    process.env.OIDC_ISSUER = TEST_ISSUER;
    process.env.OIDC_AUDIENCE = TEST_AUDIENCE;

    const module = await Test.createTestingModule({
      providers: [{ provide: JWKS_PROVIDER, useValue: issuer.jwks }, OidcAuthService],
    }).compile();

    service = module.get(OidcAuthService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should verify a valid token and return AuthenticatedUser', async () => {
    const token = await issuer.issueToken();
    const user = await service.verifyToken(token);

    expect(user.sub).toBe('test-user-id');
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.username).toBe('testuser');
    expect(user.scopes).toEqual(['openid', 'profile', 'email']);
    expect(user.payload).toBeDefined();
  });

  it('should extract scopes from space-delimited scope claim', async () => {
    const token = await issuer.issueToken({ scope: 'read write admin' });
    const user = await service.verifyToken(token);

    expect(user.scopes).toEqual(['read', 'write', 'admin']);
  });

  it('should return empty scopes array when scope claim is missing', async () => {
    const token = await issuer.issueToken({ scope: undefined });
    const user = await service.verifyToken(token);

    expect(user.scopes).toEqual([]);
  });

  it('should parse name from given_name and family_name when name is absent', async () => {
    const token = await issuer.issueToken({
      name: undefined,
      given_name: 'John',
      family_name: 'Doe',
    });
    const user = await service.verifyToken(token);

    expect(user.name).toBe('John Doe');
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
  });

  it('should use given_name alone when family_name is absent', async () => {
    const token = await issuer.issueToken({
      name: undefined,
      given_name: 'John',
    });
    const user = await service.verifyToken(token);

    expect(user.name).toBe('John');
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBeUndefined();
  });

  it('should use family_name alone when given_name is absent', async () => {
    const token = await issuer.issueToken({
      name: undefined,
      family_name: 'Doe',
    });
    const user = await service.verifyToken(token);

    expect(user.name).toBe('Doe');
    expect(user.firstName).toBeUndefined();
    expect(user.lastName).toBe('Doe');
  });

  it('should return undefined name when no name fields are present', async () => {
    const token = await issuer.issueToken({ name: undefined });
    const user = await service.verifyToken(token);

    expect(user.name).toBeUndefined();
    expect(user.firstName).toBeUndefined();
    expect(user.lastName).toBeUndefined();
  });

  it('should prefer preferred_username over username', async () => {
    const token = await issuer.issueToken({
      preferred_username: 'preferred',
      username: 'fallback',
    });
    const user = await service.verifyToken(token);

    expect(user.username).toBe('preferred');
  });

  it('should fall back to username when preferred_username is absent', async () => {
    const token = await issuer.issueToken({
      preferred_username: undefined,
      username: 'fallback',
    });
    const user = await service.verifyToken(token);

    expect(user.username).toBe('fallback');
  });

  it('should return "unknown" for sub when sub claim is missing', async () => {
    const token = await issuer.issueToken({ sub: undefined });
    const user = await service.verifyToken(token);

    expect(user.sub).toBe('unknown');
  });

  it('should include the raw JWT payload', async () => {
    const token = await issuer.issueToken({ custom_claim: 'custom_value' });
    const user = await service.verifyToken(token);

    expect(user.payload).toBeDefined();
    expect(user.payload.iss).toBe(TEST_ISSUER);
    expect(user.payload.aud).toBe(TEST_AUDIENCE);
    expect((user.payload as Record<string, unknown>).custom_claim).toBe('custom_value');
  });

  it('should throw UnauthorizedException for empty token', async () => {
    await expect(service.verifyToken('')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for expired token', async () => {
    const token = await issuer.issueExpiredToken();

    await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for token signed with wrong key', async () => {
    const otherIssuer = await TestTokenIssuer.create();
    const token = await otherIssuer.issueToken();

    await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for malformed token string', async () => {
    await expect(service.verifyToken('not.a.jwt')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for completely invalid string', async () => {
    await expect(service.verifyToken('garbage')).rejects.toThrow(UnauthorizedException);
  });
});
