# Database

This project uses **Prisma 7** with **PostgreSQL** via the `@prisma/adapter-pg` driver adapter.

## Local Setup

See the [README](README.md#setup) — `docker compose up -d` starts PostgreSQL and Redis locally.

## Schema

The Prisma schema lives at `prisma/schema.prisma`. After any schema change, run `prisma generate` to regenerate the client (this also runs automatically via `postinstall`).

## Common Commands

```bash
# Generate the Prisma client (runs automatically on pnpm install)
pnpm dlx prisma generate

# Create a migration from schema changes
pnpm dlx prisma migrate dev --name <migration_name>

# Apply pending migrations (CI / production)
pnpm dlx prisma migrate deploy

# Reset the database (drops all data, re-applies migrations)
pnpm dlx prisma migrate reset

# Open Prisma Studio (GUI for browsing data)
pnpm dlx prisma studio

# Pull the current database schema into schema.prisma
pnpm dlx prisma db pull

# Push schema changes directly without creating a migration (prototyping only)
pnpm dlx prisma db push

# Check migration status
pnpm dlx prisma migrate status

# Format the schema file
pnpm dlx prisma format
```

## Migrations

### Creating a Migration

1. Edit `prisma/schema.prisma`
2. Run `pnpm dlx prisma migrate dev --name describe_the_change`
3. Prisma generates a SQL file in `prisma/migrations/` and applies it to your local database
4. Commit both the schema and migration files

### Migration Naming

Use snake_case descriptions that explain what changed:

```
add_exercises_table
add_index_on_workout_date
rename_sets_to_set_entries
drop_legacy_columns
```

### Editing a Migration Before Applying

If you need custom SQL (e.g. backfilling data), use `--create-only` to generate the migration without applying it:

```bash
pnpm dlx prisma migrate dev --name add_default_values --create-only
```

Edit the generated SQL file in `prisma/migrations/<timestamp>_add_default_values/migration.sql`, then apply:

```bash
pnpm dlx prisma migrate dev
```

### Production Deployments

Never use `migrate dev` in production. Use `migrate deploy` which only applies pending migrations without generating new ones:

```bash
pnpm dlx prisma migrate deploy
```

## Schema Conventions

### Table and Column Mapping

Use `@@map` and `@map` to keep Prisma model names in PascalCase while using snake_case in the database:

```prisma
model WorkoutLog {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("workout_logs")
}
```

### IDs

Use `cuid()` for generated IDs. For external IDs (e.g. OIDC subject), use a plain `@id` without a default:

```prisma
model User {
  id String @id  // external ID, no default
}

model Exercise {
  id String @id @default(cuid())  // internal ID
}
```

### Indexes

Add indexes on columns that are frequently queried, filtered, or sorted:

```prisma
model WorkoutLog {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  date      DateTime

  @@index([userId])           // filter by user
  @@index([userId, date])     // filter by user + sort by date
  @@map("workout_logs")
}
```

**When to add indexes:**

- Foreign key columns used in `WHERE` or `JOIN` clauses
- Columns used in `ORDER BY` with a filter
- Columns used in unique lookups — use `@@unique` instead of `@@index`
- Composite filters (e.g. querying by `userId` + `date`)

**When to skip indexes:**

- Tables with very few rows
- Columns that are rarely queried directly
- Columns with very low cardinality (e.g. boolean flags) unless part of a composite index

### Relations

Always specify `onDelete` behavior explicitly:

```prisma
model OrganizationMember {
  userId         String @map("user_id")
  organizationId String @map("organization_id")

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

Common choices:

- `Cascade` — delete child when parent is deleted (memberships, logs)
- `Restrict` — prevent deleting parent if children exist (references that shouldn't be orphaned)
- `SetNull` — set FK to null when parent is deleted (optional references)

### Enums

Define enums at the schema level and use descriptive names:

```prisma
enum OrganizationRole {
  MEMBER
  STAFF
  ADMIN
}
```

## Type-Safe Queries

### Using the Prisma Client

Import the singleton from shared utils:

```typescript
import { prisma } from '@/shared/utils';
```

### Select Only What You Need

Use `select` to avoid over-fetching:

```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, email: true, name: true },
});
// user is typed as { id: string; email: string | null; name: string | null } | null
```

### Type-Safe Includes

Use `include` when you need related records:

```typescript
const userWithOrgs = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    memberships: {
      include: { organization: true },
    },
  },
});
```

### Inferred Types from Queries

Use `Prisma` namespace types for function signatures and DTOs. Extract the return type of a query using `Prisma.PromiseReturnType`:

```typescript
import { Prisma } from '@/generated/prisma/client';

// Reuse a query shape as a type
type UserWithMemberships = Prisma.UserGetPayload<{
  include: { memberships: true };
}>;

function formatUser(user: UserWithMemberships) {
  return { id: user.id, orgs: user.memberships.length };
}
```

### Validated Inputs with Prisma Types

Use Prisma's generated input types for type-safe write operations:

```typescript
import { Prisma } from '@/generated/prisma/client';

async function createUser(data: Prisma.UserCreateInput) {
  return prisma.user.create({ data });
}
```

### Transactions

Use interactive transactions for operations that must be atomic:

```typescript
await prisma.$transaction(async (tx) => {
  const org = await tx.organization.create({ data: { name: 'Acme' } });
  await tx.organizationMember.create({
    data: {
      userId,
      organizationId: org.id,
      role: 'ADMIN',
    },
  });
});
```

### Handling Not Found

Use `findUniqueOrThrow` / `findFirstOrThrow` to throw instead of returning null:

```typescript
// Throws PrismaClientKnownRequestError (P2025) if not found
const user = await prisma.user.findUniqueOrThrow({
  where: { id: userId },
});
```
