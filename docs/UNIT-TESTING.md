# Unit Testing

This project uses **Vitest** for unit testing, with **@nestjs/testing** for module bootstrapping.

## Commands

```bash
pnpm test          # Run all tests once
pnpm test:watch    # Run tests in watch mode
```

## Configuration

Vitest config lives at `vitest.config.ts`. It extends the Vite config so path aliases (`@/*`, `~/*`) work in tests.

- Test files: `src/**/*.spec.ts`
- Environment: `node`

## File Structure

Tests live in `__tests__/` directories alongside the code they test:

```
src/rest/auth/
├── oidc-auth.service.ts
├── oidc.guard.ts
└── __tests__/
    ├── oidc-auth.service.spec.ts
    ├── oidc.guard.spec.ts
    └── test-token-issuer.ts       # Shared test helper
```

Name test files `<subject>.spec.ts`. Non-test helpers (fixtures, factories, utilities) use plain `.ts` names and live in the same `__tests__/` directory.

## Writing Tests

### Basic Structure

```typescript
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

describe('MyService', () => {
  let service: MyService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [MyService],
    }).compile();

    service = module.get(MyService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', () => {
    expect(service.doSomething()).toBe('result');
  });
});
```

### Mocking Prisma & Redis

The Prisma client and Redis connections are singletons from `@/shared/utils`. Mock the entire module with `vi.mock` **before** importing the code under test:

```typescript
const mockUser = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

vi.mock('@/shared/utils', () => ({
  prisma: {
    user: mockUser,
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ user: mockUser }),
    ),
  },
  redis: {},
  redisSub: {},
}));

// Dynamic import AFTER vi.mock is registered
const { MyService } = await import('../my.service');
```

Key points:

- `vi.mock` must be called **before** any dynamic imports of modules that use `@/shared/utils`
- Use `await import(...)` (dynamic import) for the module under test so the mock is in place
- Mock `$transaction` by calling the callback with your mock models — this lets transaction-based code work without a real database
- Call `vi.clearAllMocks()` in `beforeEach` to reset call counts between tests

### Mocking NestJS Providers

When a service depends on injected providers, supply them in the testing module:

```typescript
const module = await Test.createTestingModule({
  providers: [
    MyService,
    { provide: SomeDependency, useValue: mockDependency },
  ],
}).compile();
```

### Testing Guards

Guards need a mock `ExecutionContext`. Build one that returns a mock request:

```typescript
function createMockContext(
  request: Record<string, unknown> & { headers: Record<string, string> },
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => () => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}
```

### Testing Exceptions

Use `rejects.toThrow` for async code that should throw:

```typescript
import { NotFoundException } from '@nestjs/common';

it('should throw NotFoundException when not found', async () => {
  mockUser.findUnique.mockResolvedValue(null);

  await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
});
```

### Factory Helpers

Create factory functions for mock data to keep tests concise:

```typescript
const NOW = new Date('2026-01-01T00:00:00Z');

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
```

## What to Test

**Do test:**

- Service business logic (authorization checks, data transformations, error conditions)
- Guards (token validation, public route bypass)
- Edge cases (missing fields, invalid input, concurrent operations)

**Don't test:**

- NestJS framework wiring (module imports, decorator metadata)
- Prisma query syntax (trust the ORM)
- Controller methods that only delegate to a service — test the service instead
