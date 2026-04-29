import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  jwtVerify,
  type JWTPayload,
  type JWTVerifyResult,
  type FlattenedJWSInput,
  type JWSHeaderParameters,
  type GetKeyFunction,
} from 'jose';
import { JWKS_PROVIDER } from '@/rest/auth/auth.constants';

export type JWKSFunction = GetKeyFunction<JWSHeaderParameters, FlattenedJWSInput>;

export type AuthenticatedUser = {
  sub: string;
  username?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  scopes: string[];
  payload: JWTPayload;
};

@Injectable()
export class OidcAuthService {
  private readonly issuer?: string;
  private readonly audience?: string;

  constructor(@Inject(JWKS_PROVIDER) private readonly jwks: JWKSFunction) {
    this.issuer = process.env.OIDC_ISSUER || undefined;
    this.audience = process.env.OIDC_AUDIENCE || undefined;
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const { payload }: JWTVerifyResult<JWTPayload> = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256', 'RS512'],
      });

      const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];

      // Parse name from various possible fields
      const payloadRecord = payload as Record<string, string>;
      const name =
        payloadRecord.name ??
        (payloadRecord.given_name && payloadRecord.family_name
          ? `${payloadRecord.given_name} ${payloadRecord.family_name}`
          : (payloadRecord.given_name ?? payloadRecord.family_name));

      const firstName = payloadRecord.given_name;
      const lastName = payloadRecord.family_name;

      if (!payload.sub) {
        throw new UnauthorizedException('Token missing required sub claim');
      }

      return {
        sub: payload.sub,
        username: payloadRecord.preferred_username ?? payloadRecord.username,
        name,
        firstName,
        lastName,
        email: payload.email as string | undefined,
        scopes,
        payload,
      };
    } catch (error) {
      throw new UnauthorizedException(`Token verification failed: ${(error as Error).message}`);
    }
  }
}
