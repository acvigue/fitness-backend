import {
  generateKeyPair,
  SignJWT,
  exportJWK,
  createLocalJWKSet,
  type KeyLike,
  type JWK,
} from 'jose';
import type { JWKSFunction } from '@/rest/auth/oidc-auth.service';

export const TEST_ISSUER = 'https://test-issuer.local';
export const TEST_AUDIENCE = 'test-audience';

export class TestTokenIssuer {
  private constructor(
    private readonly privateKey: KeyLike,
    public readonly publicJwk: JWK,
    public readonly jwks: JWKSFunction
  ) {}

  static async create(): Promise<TestTokenIssuer> {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(publicKey);
    const jwks = createLocalJWKSet({ keys: [publicJwk] });
    return new TestTokenIssuer(privateKey, publicJwk, jwks as JWKSFunction);
  }

  async issueToken(claims: Record<string, unknown> = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT({
      sub: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      preferred_username: 'testuser',
      scope: 'openid profile email',
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(this.privateKey);
  }

  async issueExpiredToken(claims: Record<string, unknown> = {}): Promise<string> {
    const past = Math.floor(Date.now() / 1000) - 7200;

    return new SignJWT({
      sub: 'test-user-id',
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setIssuedAt(past - 3600)
      .setExpirationTime(past)
      .sign(this.privateKey);
  }
}
