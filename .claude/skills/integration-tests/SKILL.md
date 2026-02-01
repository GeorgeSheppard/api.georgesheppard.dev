---
name: integration tests
description: Creating and maintaining integration tests for endpoints according to best practices
---

# Integration Test Creation Guide

This guide establishes the testing patterns and best practices for creating integration tests in this application. Integration tests use Vitest with custom fixtures that manage ephemeral PostgreSQL and RabbitMQ containers.

## Fixture System Overview

The project uses **custom Vitest fixtures** (`test/fixtures.ts`) that provide:

- **Worker-scoped containers**: PostgreSQL and RabbitMQ containers started once per test worker
- **Test-scoped clients**: Fresh database and queue clients for each test
- **Automatic cleanup**: Containers and clients are automatically managed
- **Dependency injection**: Only provide the dependencies your test needs

This approach ensures:
- Each test starts with a clean database
- Containers are efficiently reused across tests in the same worker
- No manual connection management needed
- Clear, readable test setup

## Test Structure Overview

Each endpoint requires an integration test file colocated with the endpoint source code:

```
src/websites/{website}/routes/{endpoint-name}/
├── {endpoint-name}.ts
├── {endpoint-name}-definition.ts
└── {endpoint-name}.integration.test.ts   # Integration test
```

The test strategy depends on the endpoint's actual implementation and code paths.

### Before Writing Tests: Read and Analyze the Endpoint

1. Read the endpoint handler code to identify all code paths
2. Identify any validation rules that should fail
3. Identify database operations and expected state changes
4. Identify response statuses and shapes defined in the route schema
5. Write tests for each distinct code path and branch

Do NOT assume all endpoints follow the same pattern. Each endpoint's tests should match its specific implementation logic.

---

## Integration Test Setup

### 1. Import Custom Fixtures

**File**: `src/websites/{website}/routes/{endpoint-name}/{endpoint-name}.integration.test.ts`

Always use the custom test fixtures instead of plain vitest:

```typescript
import { test, describe, expect } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { createMockEmailClient } from '@test/mocks/email.js';
import type { App } from '../../src/server.js';
import { requests, recommendations } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';

describe('POST /api/your-endpoint', () => {
  let app: App;

  test.beforeEach(async ({ dbClient, queueClient }) => {
    // Initialize app with real database and queue clients
    app = await createTestApp({
      databaseClient: dbClient,
      queueClient: queueClient,
      // Add other mocked dependencies as needed
      emailClient: createMockEmailClient(),
    });
  });

  test.afterEach(async ({ dbClient, queueClient }) => {
    // Clean up database and queue state between tests
    await queueClient.channel.purgeQueue(queueClient.textExtractionQueue);
    await dbClient.db.delete(requests);
  });

  // Tests go here
});
```

**Key Points**:

- Import `test`, `describe`, `expect` from `@test/fixtures.js` (not `vitest`)
- Use `test.beforeEach()` and `test.afterEach()` for per-test setup/cleanup
- Destructure `{ dbClient, queueClient }` from test context (these are fixtures)
- `dbClient` is a fresh database client for each test (empty database)
- `queueClient` is a fresh queue client for each test
- Use `createTestApp()` to initialize the app with specific dependencies
- Clean up database (`dbClient.db.delete()`) and queue state (`purgeQueue()`) in afterEach
- Import mock factories like `createMockEmailClient()` when needed

---

### 2. Test Validation Errors

For each field in your request schema, test that invalid input is rejected with appropriate error responses.

**Strategy**: Look at the Zod schema in the endpoint and test the constraints defined there.

```typescript
test('should return an error if requestId is not a valid UUID', async () => {
  const response = await app.request(
    new Request('http://localhost/api/your-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'requestId=not-a-uuid',
    })
  );

  expect(response.status).toBeGreaterThanOrEqual(400);
  const body = await response.json();
  expect(body).toHaveProperty('error');
});

test('should return an error if requestId is missing from request', async () => {
  const response = await app.request(
    new Request('http://localhost/api/your-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '', // Empty body - missing required field
    })
  );

  expect(response.status).toBeGreaterThanOrEqual(400);
  const body = await response.json();
  expect(body).toHaveProperty('error');
});
```

**Key Points**:

- Use `test()` (from fixtures) instead of `it()`
- Use `app.request(new Request(...))` to make HTTP requests
- Provide full URL with `http://localhost` prefix
- Set correct `method` (POST, GET, DELETE, etc.)
- Set `Content-Type` header matching route definition
- For form-urlencoded, provide `body` as URL-encoded string
- Zod validation automatically catches format errors and returns 400+ status with error property
- For missing required fields, use empty body or omit the field in URL-encoded format
- Test each validation rule defined in your Zod schema
- `app` is initialized fresh in `beforeEach()` for each test

---

### 3. Test Edge Cases and Different Code Paths

**Strategy**: Read the endpoint implementation to understand all possible code paths and branches.

Not all endpoints handle non-existent records the same way. Some may:

- Return success with no database changes (graceful no-op)
- Return an error (404 or 400)
- Create a new record
- Return a specific response based on the business logic

Write tests for each code path in your endpoint implementation.

**Example - Endpoint that does nothing if record doesn't exist**:

```typescript
test('should return 200 and not modify anything if requestId does not exist in DB', async ({ dbClient }) => {
  const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

  const response = await app.request(
    new Request('http://localhost/api/your-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `requestId=${nonExistentId}`,
    })
  );

  // Check what the endpoint actually returns
  expect(response.status).toBe(200);
  const responseBody = await response.json();
  expect(responseBody).toEqual({});

  // Verify no record was created
  const records = await dbClient.db
    .select()
    .from(requests)
    .where(eq(requests.id, nonExistentId));

  expect(records).toHaveLength(0);
});
```

**Example - Endpoint that returns 404 if record doesn't exist**:

```typescript
test('should return 404 if requestId does not exist in DB', async ({ dbClient }) => {
  const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

  const response = await app.request(
    new Request('http://localhost/api/your-endpoint', {
      method: 'GET',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `requestId=${nonExistentId}`,
    })
  );

  expect(response.status).toBe(404);
  const body = await response.json();
  expect(body).toHaveProperty('error');
});
```

**Key Points**:

- Read the endpoint code first to understand what it does
- Use valid UUID format that doesn't exist in the database
- Test the actual behavior of your endpoint, not a generic expectation
- Query the database via `dbClient.db` to verify expected state changes (or lack thereof)
- Use `.toHaveLength(0)` or `.toHaveLength(1)` to verify record count
- Destructure `{ dbClient }` from test context to access the fixture
- Database is fresh for each test (cleaned up in `afterEach()`)

---

### 4. Test Successful Operations with Database Verification

Test the happy path: valid input produces the expected response and database changes.

**Strategy**: Read the endpoint implementation to see what database operations it performs, then verify those changes occurred.

```typescript
test('should update email and related fields if requestId exists in DB', async ({ dbClient }) => {
  // 1. Create test data with initial values
  const testEmail = 'test@example.com';
  const testFrequency = 'week';
  const testDate = new Date('2025-02-15T10:00:00Z');

  const result = await dbClient.db
    .insert(requests)
    .values({
      email: testEmail,
      frequency: testFrequency,
      nextRecommendationUtc: testDate,
    })
    .returning();

  const requestId = result[0].id;

  // 2. Verify initial state (optional - helps catch test setup errors)
  let dbRequest = await dbClient.db.select().from(requests).where(eq(requests.id, requestId));

  expect(dbRequest[0].email).toBe(testEmail);
  expect(dbRequest[0].frequency).toBe(testFrequency);
  expect(dbRequest[0].nextRecommendationUtc).toEqual(testDate);

  // 3. Call the endpoint
  const response = await app.request(
    new Request('http://localhost/api/your-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `requestId=${requestId}`,
    })
  );

  // 4. Verify the response
  expect(response.status).toBe(200);
  const responseBody = await response.json();
  expect(responseBody).toEqual({});

  // 5. Verify the database was updated correctly (critical - verifies side effects)
  dbRequest = await dbClient.db.select().from(requests).where(eq(requests.id, requestId));

  expect(dbRequest[0].email).toBeNull();
  expect(dbRequest[0].frequency).toBeNull();
  expect(dbRequest[0].nextRecommendationUtc).toBeNull();
});
```

**Key Points**:

- Use `dbClient.db.insert()` to create test data for a valid scenario (direct database access)
- Use `.returning()` to get created records with generated IDs
- Verify initial database state matches test setup (helps catch test setup errors)
- Call the endpoint with valid data via `app.request()`
- Assert the response status and body match the route schema
- **Re-query the database after the API call** - critical to verify side effects actually happened
- Assert all expected database fields were modified correctly
- Verify the endpoint's side effects actually persisted to the database
- Test multiple successful scenarios if the endpoint has different behaviors for different valid inputs
- `dbClient` is fresh for each test with a clean database

---

### 5. Test Response Shape and Headers

Test that responses have the correct structure, headers, and content type as defined in the route schema.

**Strategy**: Read the route definition's `responses` section to see the expected status codes and schemas, then verify those are actually returned.

```typescript
test('should return correct response object on successful validation', async ({ dbClient }) => {
  // Create test data
  const result = await dbClient.db
    .insert(requests)
    .values({
      email: 'test2@example.com',
    })
    .returning();

  const requestId = result[0].id;

  // Call the endpoint
  const response = await app.request(
    new Request('http://localhost/api/your-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `requestId=${requestId}`,
    })
  );

  // Verify response status matches route definition
  expect(response.status).toBe(200);

  // Verify content-type header
  expect(response.headers.get('content-type')).toContain('application/json');

  // Verify response body matches the route schema definition
  const responseBody = await response.json();
  expect(responseBody).toStrictEqual({});
  expect(typeof responseBody).toBe('object');

  // If the response has fields, verify their types and presence
  // Example for an endpoint that returns data:
  // expect(responseBody).toHaveProperty('id');
  // expect(typeof responseBody.id).toBe('string');
  // expect(responseBody.email).toBe('expected@example.com');
});
```

**Key Points**:

- Read the route's `responses` section to see expected status codes and body schemas
- Assert the actual status code matches the route definition
- Assert `content-type` header contains `'application/json'`
- Use `.toStrictEqual()` for exact shape matching (works for empty objects `{}`)
- Verify data types of response fields (e.g., `typeof field === 'string'`)
- Verify fields match what's defined in the route's response schema
- Test multiple response codes if the endpoint defines different ones (e.g., 200, 201, 400)
- Use `dbClient` fixture for test data setup

---

## Test Organization Pattern

Before writing any tests, read the endpoint implementation to understand all code paths. Organize tests based on the actual behavior:

1. **Validation tests** - Test each validation rule in the Zod schema (invalid formats, missing required fields)
2. **Edge case and error path tests** - Test each distinct code path or error condition in the endpoint logic
3. **Successful operation tests** - Test each distinct successful code path (different valid inputs may have different behaviors)
4. **Response shape tests** - Verify responses match the route schema definitions

**Do NOT use a template of tests**. Each endpoint's tests should match its specific implementation.

Example test file structure (for delete-email):

```typescript
describe('POST /api/recommendations/delete-email', () => {
  // Validation tests
  it('should return an error if requestId is not a valid UUID', async () => {
    /* ... */
  });
  it('should return an error if requestId is missing from request', async () => {
    /* ... */
  });

  // Edge case: what does the endpoint do if the record doesn't exist?
  // This is endpoint-specific - don't assume all endpoints handle this the same way
  it('should return 200 and not modify anything if requestId does not exist in DB', async () => {
    /* ... */
  });

  // Success path: what changes when the endpoint succeeds?
  it('should delete email and related fields if requestId exists in DB', async () => {
    /* ... */
  });

  // Response validation
  it('should return correct response object on successful validation', async () => {
    /* ... */
  });
});
```

---

## Database Assertions Pattern

Always verify database state after endpoint calls using this pattern:

```typescript
test('should verify database state', async ({ dbClient }) => {
  // ... setup code ...

  // Query for the record
  const records = await dbClient.db.select().from(requests).where(eq(requests.id, someId));

  // Assert the record exists
  expect(records).toHaveLength(1);

  // Assert field values
  expect(records[0].email).toBe('expected@example.com');
  expect(records[0].frequency).toBeNull();
  expect(records[0].updatedUtc).toEqual(expectedDate);
});
```

**Key Points**:

- Access database via the `dbClient` fixture parameter
- Always use `.select().from(table).where(eq(...))` for queries
- Check `.toHaveLength(n)` before accessing array elements
- Use specific assertions for each field (`.toBe()`, `.toBeNull()`, `.toEqual()`)
- Verify all fields affected by the endpoint
- `dbClient` provides a fresh, empty database for each test

---

## Test Utilities Summary

### Custom Fixtures

```typescript
import { test, describe, expect } from '@test/fixtures.js';

test.beforeEach(async ({ dbClient, queueClient }) => {
  // dbClient - fresh database client for this test
  // queueClient - fresh queue client for this test
});

test.afterEach(async ({ dbClient, queueClient }) => {
  // Cleanup: delete test data and purge queues
  await queueClient.channel.purgeQueue(queueClient.textExtractionQueue);
  await dbClient.db.delete(requests);
});
```

### Creating Test App

```typescript
import { createTestApp } from '@test/utils/app.js';

const app = await createTestApp({
  databaseClient: dbClient,      // Required: use fixture
  queueClient: queueClient,      // Required: use fixture
  emailClient: createMockEmailClient(),  // Optional: inject mocks
  ipLocator: createMockIpLocator(),      // Optional: inject mocks
});
```

### Making HTTP Requests

```typescript
const response = await app.request(
  new Request('http://localhost/api/path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'field1=value1&field2=value2',
  })
);
```

### Parsing Response

```typescript
const statusCode = response.status;
const headerValue = response.headers.get('content-type');
const body = await response.json();
```

### Database Operations via Fixture

```typescript
// Insert
const result = await dbClient.db.insert(requests).values({...}).returning();

// Select
const records = await dbClient.db.select().from(requests).where(eq(...));

// Update
await dbClient.db.update(requests).set({...}).where(eq(...));

// Delete
await dbClient.db.delete(requests).where(eq(...));
```

### Queue Operations via Fixture

```typescript
// Purge a queue between tests (in afterEach)
await queueClient.channel.purgeQueue(queueClient.textExtractionQueue);

// Send message
await queueClient.channel.sendToQueue(queueClient.queue, Buffer.from(JSON.stringify({ data })));

// Check if message was queued (for verification in tests)
// Most tests verify via database changes, but queue operations can also be tested
```

### Mock Factories

```typescript
import { createMockEmailClient } from '@test/mocks/email.js';
import { createMockIpLocator } from '@test/mocks/ip-locator.js';
import { vi } from 'vitest';

const mockEmailClient = createMockEmailClient();

// Verify it was called
expect(mockEmailClient.sendRecommendationsEmail).toHaveBeenCalled();
expect(mockEmailClient.sendRecommendationsEmail).toHaveBeenCalledWith(
  expect.objectContaining({ email: 'test@example.com' })
);

// Configure return value for specific test
mockEmailClient.sendRecommendationsEmail.mockResolvedValueOnce(undefined);
```

---

## Integration Test Checklist

- [ ] **Read the endpoint code first** - Understand all code paths and branches before writing tests
- [ ] Test file created colocated with endpoint: `src/websites/{website}/routes/{endpoint-name}/{endpoint-name}.integration.test.ts`
- [ ] Import `test`, `describe`, `expect` from `@test/fixtures.js`
- [ ] Import `createTestApp` from `@test/utils/app.js`
- [ ] `test.beforeEach()` initializes `app` with `dbClient`, `queueClient`, and any needed mocks
- [ ] `test.afterEach()` cleans up: delete test data with `dbClient.db.delete()` and purge queues
- [ ] `describe()` block with endpoint path as label
- [ ] **Validation tests** - For each field in the Zod schema, test invalid values → expect 400+ status and error property
- [ ] **Validation tests** - For each required field, test when it's missing → expect 400+ status and error property
- [ ] **Edge case tests** - Test each distinct code path defined in the endpoint implementation (not template paths)
- [ ] **Success tests** - For each successful scenario, verify the expected database changes occurred
- [ ] **Response tests** - Verify the response status and body match the route schema definitions
- [ ] All database operations use `dbClient.db` (fixture) with `.select().from(table).where(eq(...))` syntax
- [ ] All HTTP requests use correct method and headers matching the route definition
- [ ] Tests verify actual endpoint behavior, not generic expectations
- [ ] Tests verify side effects actually persisted to database with follow-up SELECT queries
- [ ] Coverage includes all code paths that can be reached with valid input
- [ ] Fresh database and queue state for each test (managed by fixtures automatically)
- [ ] Mock factories imported and used for external dependencies (email, IP location, etc.)

---

## Fixture System Architecture

The project uses **Vitest fixtures** (`@test/fixtures.ts`) to manage test infrastructure. Understanding the fixture lifecycle helps you write better tests.

### Fixture Scopes

**Worker-Scoped** (started once per test worker, automatically managed):
- `postgresContainer` - PostgreSQL container for the entire test worker
- `rabbitmqContainer` - RabbitMQ container for the entire test worker
- Automatically started and stopped by Vitest
- Containers are reused across all tests in the worker

**Test-Scoped** (fresh instance for each test):
- `dbClient` - Database client (depends on `postgresContainer`)
- `queueClient` - Queue client (depends on `rabbitmqContainer`)
- Fresh instance created before each test
- Automatically closed after each test
- Each test gets a clean database (all tables empty)

### Test Lifecycle

```
Worker Starts
  ↓
PostgreSQL Container Started (once, reused for all tests in worker)
RabbitMQ Container Started (once, reused for all tests in worker)
  ↓
Test 1: beforeEach()
  ↓
Fresh dbClient and queueClient created
  ↓
Your test code runs with clean database
  ↓
afterEach() - cleanup (delete data, purge queues)
  ↓
dbClient and queueClient closed
  ↓
Test 2: beforeEach() [fresh database]
  ↓
... repeat for each test
  ↓
All Tests Complete
  ↓
Containers Stopped
```

### Why Use Fixtures?

1. **Clean Database Per Test** - Each test starts with empty tables
2. **Efficient Container Reuse** - Containers (slow to start) are reused
3. **Automatic Resource Management** - No manual connection cleanup needed
4. **Dependency Injection** - Only request the fixtures you need
5. **Clear Test Setup** - Fixture parameters make dependencies explicit

### When to Use Mocks vs Real Fixtures

**Use Real Fixtures** (`dbClient`, `queueClient`):
- Testing database interactions and persistence
- Testing message queue operations
- Testing side effects that must be verified in database

**Use Mocks** (email, IP locator, external APIs):
- Services outside your control (email providers, external APIs)
- Services you want to spy on without side effects
- Dependencies that are slow or have external requirements

### Example: Complete Test with Fixtures

```typescript
import { test, describe, expect } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { createMockEmailClient } from '@test/mocks/email.js';
import type { App } from '../../src/server.js';
import { requests } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';

describe('POST /api/recommendations/add-email', () => {
  let app: App;

  test.beforeEach(async ({ dbClient, queueClient }) => {
    // Create fresh app with fixtures and mocks for each test
    app = await createTestApp({
      databaseClient: dbClient,           // Use fixture
      queueClient: queueClient,           // Use fixture
      emailClient: createMockEmailClient(), // Mock external service
    });
  });

  test.afterEach(async ({ dbClient, queueClient }) => {
    // Clean up between tests (database state, queue messages)
    await dbClient.db.delete(requests); // Clear test data
    await queueClient.channel.purgeQueue(queueClient.queue); // Clear queue
  });

  test('should send email when email is added', async ({ dbClient }) => {
    // Create test data using fresh fixture database
    const [request] = await dbClient.db
      .insert(requests)
      .values({ email: 'old@example.com' })
      .returning();

    // Make HTTP request
    const response = await app.request(
      new Request('http://localhost/api/recommendations/add-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `requestId=${request.id}&email=new@example.com`,
      })
    );

    // Verify response
    expect(response.status).toBe(200);

    // Verify database was updated (use fixture)
    const [updated] = await dbClient.db
      .select()
      .from(requests)
      .where(eq(requests.id, request.id));

    expect(updated.email).toBe('new@example.com');
  });
});
```

This example shows:
- Fresh `dbClient` and `queueClient` per test
- Creating test data via `dbClient.db.insert()`
- Making HTTP requests to test app
- Verifying database changes via `dbClient.db.select()`
- Cleaning up in `afterEach()`
