---
name: integration tests
description: Creating and maintaining integration tests for endpoints according to best practices
---

# Integration Test Creation Guide

This guide establishes the testing patterns and best practices for creating integration tests in this application. An AI assistant should follow this checklist to write comprehensive tests with near 100% coverage without additional input.

## Test Structure Overview

Each endpoint requires an integration test file in `test/integration/[endpoint-name].test.ts`. The test strategy depends on the endpoint's actual implementation and code paths.

### Before Writing Tests: Read and Analyze the Endpoint

1. Read the endpoint handler code to identify all code paths
2. Identify any validation rules that should fail
3. Identify database operations and expected state changes
4. Identify response statuses and shapes defined in the route schema
5. Write tests for each distinct code path and branch

Do NOT assume all endpoints follow the same pattern. Each endpoint's tests should match its specific implementation logic.

---

## Integration Test Checklist

### 1. Test File Setup

**File**: `test/integration/[endpoint-name].test.ts`

Create a test file with standard setup/teardown and describe block:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabaseClient, DatabaseClient } from '@core/database/client.js';
import { requests } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { App, createApp } from '../../src/server.js';
import { config } from '@config/index.js';
import { createQueueClient, QueueClient } from '@core/queue/client.js';

let app: App;
let databaseClient: DatabaseClient;
let queueClient: QueueClient;

beforeAll(async () => {
  databaseClient = await createDatabaseClient(config.DATABASE_URL);
  queueClient = await createQueueClient(config.RABBITMQ_URL);
  app = await createApp(databaseClient, queueClient);
});

afterAll(async () => {
  queueClient.close();
  databaseClient.close();
});

describe('POST /api/your-endpoint', () => {
  // Tests go here
});
```

**Key Points**:

- Import test utilities from `vitest`
- Import `DatabaseClient`, `QueueClient`, and `App` from their respective modules
- Import the database tables and ORM utilities needed for assertions
- Initialize clients in `beforeAll()`
- Close connections in `afterAll()`
- Use `describe()` with the endpoint path as the label
- Each `it()` block should test one specific behavior

---

### 2. Test Validation Errors

For each field in your request schema, test that invalid input is rejected with appropriate error responses.

**Strategy**: Look at the Zod schema in the endpoint and test the constraints defined there.

```typescript
it('should return an error if requestId is not a valid UUID', async () => {
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

it('should return an error if requestId is missing from request', async () => {
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

- Use `app.request(new Request(...))` to make HTTP requests
- Provide full URL with `http://localhost` prefix
- Set correct `method` (POST, GET, DELETE, etc.)
- Set `Content-Type` header matching route definition
- For form-urlencoded, provide `body` as URL-encoded string
- Zod validation automatically catches format errors and returns 400+ status with error property
- For missing required fields, use empty body or omit the field in URL-encoded format
- Test each validation rule defined in your Zod schema

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
it('should return 200 and not modify anything if requestId does not exist in DB', async () => {
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
  const records = await databaseClient.db
    .select()
    .from(requests)
    .where(eq(requests.id, nonExistentId));

  expect(records).toHaveLength(0);
});
```

**Example - Endpoint that returns 404 if record doesn't exist**:

```typescript
it('should return 404 if requestId does not exist in DB', async () => {
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
- Query the database to verify expected state changes (or lack thereof)
- Use `.toHaveLength(0)` or `.toHaveLength(1)` to verify record count

---

### 4. Test Successful Operations with Database Verification

Test the happy path: valid input produces the expected response and database changes.

**Strategy**: Read the endpoint implementation to see what database operations it performs, then verify those changes occurred.

```typescript
it('should update email and related fields if requestId exists in DB', async () => {
  // 1. Create test data with initial values
  const testEmail = 'test@example.com';
  const testFrequency = 'week';
  const testDate = new Date('2025-02-15T10:00:00Z');

  const result = await databaseClient.db
    .insert(requests)
    .values({
      email: testEmail,
      frequency: testFrequency,
      nextRecommendationUtc: testDate,
    })
    .returning();

  const requestId = result[0].id;

  // 2. Verify initial state
  let dbRequest = await databaseClient.db.select().from(requests).where(eq(requests.id, requestId));

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

  // 5. Verify the database was updated correctly
  dbRequest = await databaseClient.db.select().from(requests).where(eq(requests.id, requestId));

  expect(dbRequest[0].email).toBeNull();
  expect(dbRequest[0].frequency).toBeNull();
  expect(dbRequest[0].nextRecommendationUtc).toBeNull();
});
```

**Key Points**:

- Use `databaseClient.db.insert()` to create test data for a valid scenario
- Use `.returning()` to get created records with generated IDs
- Verify initial database state matches test setup
- Call the endpoint with valid data
- Assert the response status and body match the route schema
- Re-query the database after the API call
- Assert all expected database fields were modified correctly
- Verify the endpoint's side effects actually persisted to the database
- Test multiple successful scenarios if the endpoint has different behaviors for different valid inputs

---

### 5. Test Response Shape and Headers

Test that responses have the correct structure, headers, and content type as defined in the route schema.

**Strategy**: Read the route definition's `responses` section to see the expected status codes and schemas, then verify those are actually returned.

```typescript
it('should return correct response object on successful validation', async () => {
  // Create test data
  const result = await databaseClient.db
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
// Query for the record
const records = await databaseClient.db.select().from(requests).where(eq(requests.id, someId));

// Assert the record exists
expect(records).toHaveLength(1);

// Assert field values
expect(records[0].email).toBe('expected@example.com');
expect(records[0].frequency).toBeNull();
expect(records[0].updatedUtc).toEqual(expectedDate);
```

**Key Points**:

- Always use `.select().from(table).where(eq(...))` for queries
- Check `.toHaveLength(n)` before accessing array elements
- Use specific assertions for each field (`.toBe()`, `.toBeNull()`, `.toEqual()`)
- Verify all fields affected by the endpoint

---

## Test Utilities Summary

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

### Database Operations

```typescript
// Insert
const result = await databaseClient.db.insert(requests).values({...}).returning();

// Select
const records = await databaseClient.db.select().from(requests).where(eq(...));

// Update
await databaseClient.db.update(requests).set({...}).where(eq(...));

// Delete
await databaseClient.db.delete(requests).where(eq(...));
```

---

## Integration Test Checklist

- [ ] **Read the endpoint code first** - Understand all code paths and branches before writing tests
- [ ] Test file created in `test/integration/[endpoint-name].test.ts`
- [ ] `beforeAll()` initializes `databaseClient`, `queueClient`, and `app`
- [ ] `afterAll()` closes all client connections
- [ ] `describe()` block with endpoint path as label
- [ ] **Validation tests** - For each field in the Zod schema, test invalid values → expect 400+ status and error property
- [ ] **Validation tests** - For each required field, test when it's missing → expect 400+ status and error property
- [ ] **Edge case tests** - Test each distinct code path defined in the endpoint implementation (not template paths)
- [ ] **Success tests** - For each successful scenario, verify the expected database changes occurred
- [ ] **Response tests** - Verify the response status and body match the route schema definitions
- [ ] All database assertions use `.select().from(table).where(eq(...))` with proper drizzle-orm syntax
- [ ] All HTTP requests use correct method and headers matching the route definition
- [ ] Tests verify actual endpoint behavior, not generic expectations
- [ ] Tests verify side effects actually persisted to database with follow-up SELECT queries
- [ ] Coverage includes all code paths that can be reached with valid input
