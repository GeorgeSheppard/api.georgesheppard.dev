# Unit Test Guide

Unit tests validate handler business logic without external dependencies (no containers, no network). They run via `pnpm test` and complete in seconds.

## When to Use Unit vs Integration Tests

| Concern                             | Unit Test | Integration Test |
| ----------------------------------- | --------- | ---------------- |
| Handler business logic              | Yes       | -                |
| Data transformations                | Yes       | -                |
| Branching / conditional paths       | Yes       | -                |
| Error propagation                   | Yes       | -                |
| Database queries (SQL correctness)  | -         | Yes              |
| Middleware chain (auth, validation) | -         | Yes              |
| Full HTTP request/response cycle    | -         | Yes              |
| Schema validation (Zod)             | -         | Yes              |

## File Naming

- Unit tests: `*.test.ts` (e.g., `get-recipes.test.ts`)
- Integration tests: `*.integration.test.ts` (e.g., `get-recipes.integration.test.ts`)
- Co-locate with the handler: `src/websites/<site>/endpoints/<name>/<name>.test.ts`

The vitest config automatically routes `*.test.ts` to the `unit` project and `*.integration.test.ts` to the appropriate integration project.

## Handler Pattern (Required for Unit Testability)

Handlers must be **exported functions** that:

1. Accept Hono `Context` (or `ContextWithUserId`) and validated inputs as parameters
2. Access dependencies via `c.get()` (e.g., `c.get('databaseClient')`)
3. Call **utility functions** for external operations (DB, S3, DynamoDB, etc.)
4. Return a typed result (not a Hono `Response`)

### KitchenCalm Pattern (Existing)

Handlers return data directly. The route registration always returns 200.

```typescript
// get-recipes.ts (handler)
export async function getRecipes(c: ContextWithUserId): Promise<GetRecipesResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');
  const recipes = await getAllRecipesForUser(dynamoClient.client, userId);
  // ... transform and return
}

// index.ts (route registration - thin wrapper)
app.openapi(getRecipesRoute, async (c) => {
  const result = await getRecipes(c as ContextWithUserId);
  return c.json(result, 200);
});
```

### Multi-Status Pattern (For Endpoints with Multiple Response Codes)

Handlers return a discriminated union with `status` and `body`. The route registration uses a `switch` to satisfy Hono's typed responses.

```typescript
// get-by-id.ts (handler)
export type GetByIdResult =
  | { status: 200; body: GetByIdSuccess }
  | { status: 404; body: GetByIdError }
  | { status: 422; body: GetByIdError };

export async function getById(c: Context, id: string): Promise<GetByIdResult> {
  const { db } = c.get('databaseClient');
  const recommendation = await findRecommendationWithRequest(db, id);

  if (!recommendation) {
    return { status: 404, body: { error: 'Recommendation not found', success: false } };
  }
  // ...
}

// Route registration
app.openapi(route, async (c) => {
  const { id } = c.req.valid('param');
  const result = await getById(c, id);
  switch (result.status) {
    case 200:
      return c.json(result.body, 200);
    case 404:
      return c.json(result.body, 404);
    case 422:
      return c.json(result.body, 422);
  }
});
```

## Writing Unit Tests

### 1. Mock Utility Functions with `vi.mock()`

Mock the **utility module** that the handler imports. This replaces all exports with auto-mocked versions.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRecipes } from './get-recipes.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

// Mock the utility module - all exports become vi.fn()
vi.mock('@core/dynamodb/utilities.js');
import { getAllRecipesForUser } from '@core/dynamodb/utilities.js';
```

> `vi.mock()` is hoisted by vitest, so import order doesn't matter.

### 2. Create Mock Context with `createMockContext()`

Only provide the dependencies your handler accesses. Accessing an unprovided dependency throws a helpful error (same pattern as `createTestApp()`).

```typescript
// Handler accesses userId and dynamoClient
const c = createMockContext<ContextWithUserId>({
  userId: '550e8400-e29b-41d4-a716-446655440000',
  dynamoClient: { client: {} },
});

// Handler only accesses databaseClient
const c = createMockContext({
  databaseClient: { db: {} },
});
```

The dependency values can be stubs (e.g., `{ client: {} }`) because the utility functions are mocked and won't actually use them. The stub just prevents the handler from throwing when it calls `c.get()`.

### 3. Configure Mock Return Values Per Test

```typescript
describe('getRecipes handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty object when no recipes', async () => {
    vi.mocked(getAllRecipesForUser).mockResolvedValue([]);
    const result = await getRecipes(mockContext());
    expect(result).toEqual({});
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getAllRecipesForUser).mockRejectedValue(new Error('DynamoDB error'));
    await expect(getRecipes(mockContext())).rejects.toThrow('DynamoDB error');
  });
});
```

### 4. Verify Utility Function Calls

```typescript
it('should pass correct arguments to utility function', async () => {
  const mockClient = { client: { query: 'mock' } };
  const c = createMockContext<ContextWithUserId>({
    userId: 'user-123',
    dynamoClient: mockClient,
  });
  vi.mocked(getAllRecipesForUser).mockResolvedValue([]);

  await getRecipes(c);

  expect(getAllRecipesForUser).toHaveBeenCalledWith(mockClient.client, 'user-123');
});
```

## Refactoring Shelfie Endpoints

Shelfie endpoints currently have inline handlers. To make them unit-testable:

### 1. Extract DB Queries into Query Functions

Create `src/websites/shelfie/queries/<domain>.ts`:

```typescript
// queries/recommendations.ts
export async function findRecommendationWithRequest(
  db: DatabaseClient['db'],
  id: string
): Promise<RecommendationWithRequest | null> {
  const result = await db.select({...}).from(recommendations)...
  return result[0] ?? null;
}
```

### 2. Extract Handler Function

Export a handler function from the route file. Keep the route definition and registration in the same file.

```typescript
// Before (inline)
export function registerGetByIdRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { id } = c.req.valid('param');
    const { db } = c.get('databaseClient');
    const result = await db.select(...)...  // DB query inline
    // ... business logic inline
    return c.json(data, 200);
  });
}

// After (extracted)
export async function getById(c: Context, id: string): Promise<GetByIdResult> {
  const { db } = c.get('databaseClient');
  const recommendation = await findRecommendationWithRequest(db, id);
  // ... pure business logic
  return { status: 200, body: data };
}

export function registerGetByIdRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { id } = c.req.valid('param');
    const result = await getById(c, id);
    switch (result.status) { ... }
  });
}
```

### 3. Write Unit Test

Mock the query function, test the handler logic:

```typescript
vi.mock('../../queries/recommendations.js');
import { findRecommendationWithRequest } from '../../queries/recommendations.js';

it('should return 404 when not found', async () => {
  vi.mocked(findRecommendationWithRequest).mockResolvedValue(null);
  const result = await getById(mockContext(), 'non-existent-id');
  expect(result).toEqual({
    status: 404,
    body: { error: 'Recommendation not found', success: false },
  });
});
```

## Complete Example

See these files for the canonical patterns:

**KitchenCalm (utility function mocking):**

- Handler: `src/websites/kitchencalm/endpoints/get-recipes/get-recipes.ts`
- Test: `src/websites/kitchencalm/endpoints/get-recipes/get-recipes.test.ts`

**Shelfie (refactored with query extraction):**

- Query: `src/websites/shelfie/queries/recommendations.ts`
- Handler + Route: `src/websites/shelfie/routes/recommendations/get-by-id.ts`
- Test: `src/websites/shelfie/routes/recommendations/get-by-id.test.ts`

**Test utility:**

- Mock context: `test/utils/mock-context.ts`

## Checklist for New Endpoints

1. [ ] Handler is an exported async function (not inline in route registration)
2. [ ] Handler takes `Context`/`ContextWithUserId` + validated inputs as parameters
3. [ ] External operations go through utility/query functions (not inline DB calls)
4. [ ] Handler returns typed data (not a Hono Response)
5. [ ] Unit test mocks utility functions with `vi.mock()`
6. [ ] Unit test uses `createMockContext()` for dependency injection
7. [ ] `beforeEach` calls `vi.clearAllMocks()`
8. [ ] Tests cover: success path, error propagation, edge cases, argument passing
