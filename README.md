# API

NestJS REST API with OIDC authentication, Prisma ORM, Redis, and OpenAPI documentation.

## Prerequisites

- Node.js 22+
- pnpm
- PostgreSQL
- Redis

## Setup

```bash
pnpm install
cp .env.example .env
# Edit .env with your database, Redis, and OIDC configuration
```

## Development

```bash
pnpm dev          # Start dev server (vite-node)
pnpm build        # Production build
pnpm start        # Run production build
pnpm lint         # ESLint check
pnpm lint:fix     # ESLint auto-fix
pnpm format       # Prettier format
```

API documentation is available at `/docs` when the server is running.

## Project Structure

```
src/
├── index.ts                    # Entry point
├── rest/
│   ├── app.module.ts           # Root NestJS module
│   ├── rest-server.ts          # Server setup, CORS, Swagger
│   ├── modules.ts              # Feature module registry
│   ├── config/                 # API constants
│   ├── auth/                   # OIDC authentication (guard, service, decorators)
│   ├── common/                 # Shared filters, decorators, DTOs
│   ├── health/                 # GET /v1/health
│   └── user/                   # GET /v1/user/me
├── shared/
│   ├── utils.ts                # Prisma & Redis clients
│   ├── auth.ts                 # JWT helpers
│   ├── current-user.decorator.ts
│   ├── logger/                 # Logger service
│   └── email/                  # MJML email service
└── generated/prisma/           # Prisma client (auto-generated)
```

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced via commitlint + husky.

```
type(scope): description

# Examples
feat(auth): add refresh token support
fix(health): handle database timeout gracefully
docs(readme): update setup instructions
refactor(user): extract DTO mapping to service
chore(deps): bump nestjs to v11.2
test(auth): add guard unit tests
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines including AI usage policy.

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `REST_PORT` | Server port (default: 9090) | No |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `OIDC_ISSUER` | OIDC token issuer URL | No |
| `OIDC_AUDIENCE` | OIDC token audience | No |
| `OIDC_JWKS_URI` | OIDC JWKS endpoint | Yes |
| `SMTP_HOST` | SMTP server hostname | No |
| `SMTP_PORT` | SMTP server port | No |
| `SMTP_USER` | SMTP username | No |
| `SMTP_PASS` | SMTP password | No |

## Tech Stack

- **Framework**: NestJS 11
- **ORM**: Prisma 7 (PostgreSQL)
- **Cache**: Redis (ioredis)
- **Auth**: OIDC/JWT (jose)
- **Docs**: Swagger/OpenAPI
- **Validation**: class-validator + class-transformer
- **Email**: Nodemailer + MJML + Handlebars
- **Build**: Vite + SWC
