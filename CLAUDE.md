# Project Architecture

NestJS REST API template with OIDC authentication, Prisma ORM, Redis, and OpenAPI documentation.

## Tech Stack

- **Runtime**: Node.js (ES modules)
- **Framework**: NestJS 11
- **ORM**: Prisma 7 with PostgreSQL (using `@prisma/adapter-pg`)
- **Cache/PubSub**: Redis via `ioredis`
- **Auth**: OIDC JWT verification via `jose` (RS256/RS512)
- **Docs**: Swagger/OpenAPI via `@nestjs/swagger`
- **Validation**: `class-validator` + `class-transformer`
- **Build**: Vite + SWC (ESM output)

## Commands

```bash
pnpm dev          # Dev server via vite-node
pnpm build        # Production build → dist/index.js
pnpm start        # Run production build
pnpm lint         # ESLint
pnpm lint:fix     # ESLint with auto-fix
pnpm format       # Prettier write
pnpm format:check # Prettier check
```

Prisma is generated automatically via `postinstall`.

## Project Structure

```
src/
├── index.ts                        # Bootstrap entry point
├── rest/
│   ├── app.module.ts               # Root NestJS module
│   ├── rest-server.ts              # Server setup, CORS, Swagger, pipes
│   ├── modules.ts                  # Feature module registry
│   ├── config/
│   │   └── rest.constants.ts       # API title, version, CORS origins
│   ├── auth/                       # OIDC authentication
│   │   ├── auth.module.ts
│   │   ├── oidc.guard.ts           # Global guard, validates bearer tokens
│   │   ├── oidc-auth.service.ts    # JWT verification with JWKS
│   │   ├── auth.types.ts           # AuthenticatedRequest type
│   │   └── public.decorator.ts     # @Public() to bypass auth
│   ├── common/                     # Shared REST utilities
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts  # Global exception → JSON
│   │   ├── decorators/
│   │   │   └── api-error-responses.decorator.ts  # Swagger error helpers
│   │   └── dto/
│   │       └── error-response.dto.ts     # Standardized error shape
│   ├── health/                     # GET /v1/health (public)
│   └── user/                       # GET /v1/user/me (authenticated)
├── shared/
│   ├── utils.ts                    # Prisma client, Redis clients
│   ├── auth.ts                     # Shared-secret JWT creation helper
│   ├── current-user.decorator.ts   # @CurrentUser() param decorator
│   └── logger/                     # Custom LoggerService (NestJS-compatible)
└── generated/
    └── prisma/                     # Generated Prisma client
prisma/
├── schema.prisma                   # Database schema
└── migrations/                     # Prisma migrations
```

## Architecture Patterns

### Authentication

OIDC-based. All routes require a valid bearer token by default. Use `@Public()` to opt out.

```typescript
// In a controller:
@Public()                              // No auth required
@Get('open')
getPublic() { ... }

@ApiBearerAuth()                       // Auth required (default)
@Get('protected')
getProtected(@CurrentUser() user: AuthenticatedUser) { ... }
```

The `AuthenticatedUser` type:
```typescript
{
  sub: string;           // User ID from IdP
  username?: string;
  name?: string;
  email?: string;
  scopes: string[];
  organizationId?: string;
  payload: JWTPayload;   // Raw JWT payload
}
```

### API Versioning

URI-based versioning. Default version is `1`. Controllers set their version:

```typescript
@Controller({ path: 'items', version: '1' })  // → /v1/items
```

### DTOs & Validation

Request DTOs use `class-validator` decorators. Response DTOs use `@nestjs/swagger` decorators.

```typescript
// Request DTO
export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

// Response DTO
export class ItemResponseDto {
  @ApiProperty({ description: 'Item ID', example: '123' })
  id!: string;

  @ApiProperty({ description: 'Item name', example: 'Widget' })
  name!: string;
}
```

Global `ValidationPipe` is configured with `whitelist: true` and `transform: true`.

### OpenAPI / Swagger

Available at `/docs`. Uses `DocumentBuilder` with bearer auth. Decorate controllers:

```typescript
@ApiTags('Items')
@ApiBearerAuth()
@Controller({ path: 'items', version: '1' })
export class ItemsController {
  @ApiOperation({ summary: 'List items' })
  @ApiResponse({ status: 200, type: [ItemResponseDto] })
  @Get()
  list() { ... }
}
```

Error response helpers: `@ApiCommonErrorResponses()`, `@ApiBadRequestResponse()`, etc.

### Error Handling

Global `HttpExceptionFilter` catches all exceptions and returns:

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Validation failed",
  "details": ["name must be a string"],
  "path": "/v1/items",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Rate Limiting

Global `ThrottlerGuard`: 20 req/s, 100 req/10s, 300 req/min. Use `@SkipThrottle()` to bypass.

### Database

Prisma client is a singleton exported from `src/shared/utils.ts`. Use it directly in services:

```typescript
import { prisma } from '@/shared/utils';
const items = await prisma.item.findMany();
```

### Redis

Two Redis clients exported from `src/shared/utils.ts`:
- `redis` — general purpose (publish, get/set)
- `redisSub` — dedicated subscriber connection

### Adding a New Module

1. Create `src/rest/<name>/` with controller, service, module, and `dto/` folder
2. Register in `src/rest/modules.ts`
3. DTOs go in `src/rest/<name>/dto/`
4. Use `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` on controllers

### Path Aliases

`@/*` and `~/*` both resolve to `./src/*`.

## Documentation

The `docs/` folder contains detailed guides. **Check these before implementing** — they define the conventions for this project:

- [DATABASE.md](docs/DATABASE.md) — Prisma commands, migrations, schema conventions, type-safe queries
- [DTO.md](docs/DTO.md) — Request/response DTOs, validation rules, strong typing requirements
- [OPENAPI.md](docs/OPENAPI.md) — Swagger decorators, error response helpers, endpoint documentation
- [UNIT-TESTING.md](docs/UNIT-TESTING.md) — Vitest setup, mocking Prisma/Redis, test patterns

All requests and responses must be strongly typed through DTO classes. Never use `any`, raw objects, or untyped Prisma returns in controller or service signatures.

## Environment Variables

```bash
# Server
REST_PORT=9090

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/database"

# Redis
REDIS_URL="redis://localhost:6379"

# OIDC Authentication
OIDC_ISSUER="https://your-idp.com/realms/your-realm"
OIDC_AUDIENCE="account"
OIDC_JWKS_URI="https://your-idp.com/realms/your-realm/protocol/openid-connect/certs"

# Runtime
NODE_ENV=development
```
