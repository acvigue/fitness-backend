# OpenAPI / Swagger

API documentation is auto-generated from code decorators and served at `/docs` when the server is running.

## Setup

Swagger is configured in `src/rest/rest-server.ts` using `@nestjs/swagger`. The spec includes bearer auth and persists the authorization token across page reloads.

## Decorating Controllers

Every controller must have `@ApiTags` and `@ApiBearerAuth` (unless all routes are public):

```typescript
@ApiTags('Exercises')
@ApiBearerAuth()
@Controller({ path: 'exercises', version: '1' })
export class ExerciseController {
  // ...
}
```

## Decorating Endpoints

Every endpoint needs `@ApiOperation` and `@ApiResponse`:

```typescript
@Post()
@ApiOperation({ summary: 'Create an exercise' })
@ApiResponse({ status: 201, type: ExerciseResponseDto })
@ApiBadRequestResponse()
@ApiCommonErrorResponses()
create(
  @Body() dto: CreateExerciseDto,
  @CurrentUser() user: AuthenticatedUser,
): Promise<ExerciseResponseDto> {
  return this.exerciseService.create(dto, user.sub);
}

@Get()
@ApiOperation({ summary: 'List exercises' })
@ApiResponse({ status: 200, type: PaginatedExerciseResponseDto })
@ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
@ApiQuery({ name: 'per_page', required: false, type: Number, example: 20 })
@ApiCommonErrorResponses()
findAll(
  @Query(new ZodValidationPipe(paginationSchema)) pagination: PaginationParams,
): Promise<PaginatedExerciseResponseDto> {
  return this.exerciseService.findAll(pagination);
}

@Get(':id')
@ApiOperation({ summary: 'Get an exercise by ID' })
@ApiResponse({ status: 200, type: ExerciseResponseDto })
@ApiNotFoundResponse()
@ApiCommonErrorResponses()
findOne(@Param('id') id: string): Promise<ExerciseResponseDto> {
  return this.exerciseService.findOne(id);
}

@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Delete an exercise' })
@ApiResponse({ status: 204, description: 'Exercise deleted' })
@ApiNotFoundResponse()
@ApiCommonErrorResponses()
delete(@Param('id') id: string): Promise<void> {
  return this.exerciseService.delete(id);
}
```

## Error Response Helpers

Use the decorators from `@/rest/common` to document error responses consistently:

| Decorator | Status | When to use |
| --- | --- | --- |
| `@ApiCommonErrorResponses()` | 401, 500 | Every authenticated endpoint |
| `@ApiBadRequestResponse()` | 400 | Endpoints with request bodies |
| `@ApiNotFoundResponse()` | 404 | Endpoints with path params |
| `@ApiForbiddenResponse()` | 403 | Endpoints with authorization checks |
| `@ApiValidationErrorResponse()` | 422 | Endpoints with strict validation |

`@ApiCommonErrorResponses()` applies 401 + 500 together — use it on every authenticated endpoint.

## Response Type Rules

- The `type` in `@ApiResponse` must point to a response DTO class (see [DTO.md](DTO.md))
- For arrays, use `type: [ExerciseResponseDto]`
- For 204 No Content, use `description` instead of `type`
- Pagination query params need explicit `@ApiQuery` decorators since they use `ZodValidationPipe` (not `class-validator`)

## DTO Requirements

Swagger generates its schema from `@ApiProperty()` / `@ApiPropertyOptional()` decorators on DTO classes. Every field on a response DTO must have one of these decorators or it won't appear in the docs. See [DTO.md](DTO.md) for full details.

## Checklist for New Endpoints

1. Add `@ApiTags('ModuleName')` and `@ApiBearerAuth()` on the controller
2. Add `@ApiOperation({ summary: '...' })` on every method
3. Add `@ApiResponse({ status: ..., type: ResponseDto })` for the success case
4. Add error response decorators matching the endpoint's failure modes
5. Add `@ApiQuery(...)` for any query parameters not handled by `class-validator`
6. Verify the endpoint appears correctly at `/docs` after starting the server
