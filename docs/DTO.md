# DTOs & Validation

Every request and response must be strongly typed through DTO classes. Never use raw objects, `any`, or untyped Prisma returns in controller signatures.

## Request DTOs

Request DTOs use `class-validator` decorators for runtime validation. The global `ValidationPipe` (configured with `whitelist: true` and `transform: true`) strips unknown properties and auto-transforms types.

```typescript
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExerciseDto {
  @ApiProperty({ description: 'Exercise name', example: 'Bench Press' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Exercise description', example: 'Chest exercise' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}
```

### Rules

- Every field must have at least one `class-validator` decorator
- Use `!:` (definite assignment) for required fields, `?:` for optional fields
- Use `@IsOptional()` on optional fields — without it, the validator rejects missing fields
- Add `@MaxLength()` on all string fields to prevent unbounded input
- Use `@ApiProperty()` on required fields and `@ApiPropertyOptional()` on optional fields
- Keep DTOs in `src/rest/<module>/dto/`

### Common Validators

| Decorator | Purpose |
| --- | --- |
| `@IsString()` | String type check |
| `@IsNotEmpty()` | Rejects empty strings |
| `@IsOptional()` | Allows undefined/null |
| `@IsInt()` | Integer check |
| `@IsEnum(MyEnum)` | Enum membership |
| `@IsUUID()` | UUID format |
| `@IsEmail()` | Email format |
| `@IsDateString()` | ISO 8601 date string |
| `@Min(n)` / `@Max(n)` | Numeric bounds |
| `@MaxLength(n)` | String length cap |
| `@IsArray()` + `@ArrayMinSize(n)` | Array validation |
| `@ValidateNested({ each: true })` | Nested object validation |
| `@Type(() => NestedDto)` | Required for nested DTOs (from `class-transformer`) |

### Update DTOs

For update operations, make all fields optional:

```typescript
export class UpdateExerciseDto {
  @ApiPropertyOptional({ description: 'Exercise name', example: 'Bench Press' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;
}
```

## Response DTOs

Response DTOs define the shape of API responses. They use `@nestjs/swagger` decorators for documentation and serve as the return type for controller methods.

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExerciseResponseDto {
  @ApiProperty({ description: 'Exercise ID', example: 'clr1abc2d0000' })
  id!: string;

  @ApiProperty({ description: 'Exercise name', example: 'Bench Press' })
  name!: string;

  @ApiPropertyOptional({ description: 'Exercise description', example: 'Chest exercise' })
  description!: string | null;

  @ApiProperty({ description: 'Created timestamp', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp', format: 'date-time' })
  updatedAt!: Date;
}
```

### Rules

- Every field must have `@ApiProperty()` or `@ApiPropertyOptional()`
- Include `description` and `example` in every `@ApiProperty()`
- Nullable fields use `!: string | null` with `@ApiPropertyOptional()`
- Date fields should include `format: 'date-time'`
- Enum fields should include `enum: [...]`
- Response DTOs do **not** use `class-validator` decorators

### Controller Return Types

Controllers must declare return types using response DTOs. Never return raw Prisma models:

```typescript
// Good — strongly typed response
@Get(':id')
findOne(@Param('id') id: string): Promise<ExerciseResponseDto> {
  return this.exerciseService.findOne(id);
}

// Bad — leaks the database schema
@Get(':id')
findOne(@Param('id') id: string) {
  return this.exerciseService.findOne(id);
}
```

### Service Return Types

Services should also return response DTO types. Map Prisma results to DTOs in the service layer:

```typescript
async findOne(id: string): Promise<ExerciseResponseDto> {
  const exercise = await prisma.exercise.findUniqueOrThrow({
    where: { id },
  });

  return {
    id: exercise.id,
    name: exercise.name,
    description: exercise.description,
    createdAt: exercise.createdAt,
    updatedAt: exercise.updatedAt,
  };
}
```

If the Prisma model shape matches the DTO exactly, you can return it directly — but always declare the return type explicitly so the compiler catches drift.

## Paginated Responses

Use the shared `PaginationMetaDto` and `paginate()` helper for list endpoints:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/rest/common/pagination';

export class PaginatedExerciseResponseDto {
  @ApiProperty({ type: [ExerciseResponseDto] })
  data!: ExerciseResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
```

Query parameters use Zod validation via `ZodValidationPipe`:

```typescript
import { ZodValidationPipe, paginationSchema, type PaginationParams } from '@/rest/common/pagination';

@Get()
findAll(
  @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams,
): Promise<PaginatedExerciseResponseDto> {
  return this.exerciseService.findAll(pagination);
}
```

## Checklist for New Endpoints

1. Create request DTO with `class-validator` decorators in `src/rest/<module>/dto/`
2. Create response DTO with `@ApiProperty()` decorators in the same folder
3. Declare explicit return types on both the controller method and service method
4. Use `@ApiResponse({ type: ResponseDto })` on the controller for Swagger
5. Map Prisma results to the response DTO shape in the service
