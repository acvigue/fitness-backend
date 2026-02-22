import { Module } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { OidcAuthService } from '@/rest/auth/oidc-auth.service';
import { OidcAuthGuard } from '@/rest/auth/oidc.guard';
import { JWKS_PROVIDER } from '@/rest/auth/auth.constants';

@Module({
  providers: [
    {
      provide: JWKS_PROVIDER,
      useFactory: () => {
        const jwksUri = process.env.OIDC_JWKS_URI;
        if (!jwksUri) {
          throw new Error('OIDC_JWKS_URI environment variable must be set');
        }
        return createRemoteJWKSet(new URL(jwksUri));
      },
    },
    OidcAuthService,
    OidcAuthGuard,
  ],
  exports: [OidcAuthService, OidcAuthGuard, JWKS_PROVIDER],
})
export class AuthModule {}
