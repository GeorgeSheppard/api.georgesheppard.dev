# Integration Test Guide

This guide defines the standard patterns for writing integration tests for endpoints in this Hono application.

## Test File Organization

Integration tests are located in `test/integration/` directory:

```
test/integration/
├── {endpoint-name}.test.ts    # Tests for specific endpoint
```

## Test Structure

Each test file should follow this pattern:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { App } from '../../src/server.js';
import { createTestApp } from '../utils/app.js';

let app: App;

beforeAll(async () => {
  app = await createTestApp({});
});

describe('ENDPOINT_METHOD /endpoint/path', () => {
  describe('Success cases', () => {
    it('should return 200 with expected response', async () => {
      const response = await app.request(
        new Request('http://localhost/endpoint/path', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            /* request data */
          }),
        })
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        /* expected response type */
      };
      expect(body).toHaveProperty('field');
      expect(body.field).toBe('expected value');
    });
  });

  describe('Error cases', () => {
    it('should return 400 for invalid input', async () => {
      const response = await app.request(
        new Request('http://localhost/endpoint/path', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            /* invalid data */
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('should return 401 when unauthorized', async () => {
      const response = await app.request(
        new Request('http://localhost/endpoint/path', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            /* request data */
          }),
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
```

## Key Patterns

### Using createTestApp

Always use `createTestApp` from test utilities to create a properly initialized app:

```typescript
import { createTestApp } from '../utils/app.js';

let app: App;

beforeAll(async () => {
  app = await createTestApp({
    // Pass any dependencies that need to be mocked or configured
  });
});
```

### Testing Success Cases

Test the happy path first:

- Verify correct HTTP status code
- Verify response structure matches schema
- Verify response data values are correct

```typescript
expect(response.status).toBe(200);
const body = (await response.json()) as ExpectedType;
expect(body).toHaveProperty('field');
expect(body.field).toBe(expectedValue);
```

### Testing Error Cases

Test both validation errors and authentication errors:

- Invalid input validation
- Missing required fields
- Authentication failures
- Authorization failures
- Business logic constraints

```typescript
it('should return 400 for invalid input', async () => {
  const response = await app.request(
    new Request('http://localhost/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalidField: 'value' }),
    })
  );

  expect(response.status).toBe(400);
  const body = await response.json();
  expect(body).toHaveProperty('error');
});
```

### Testing Authenticated Endpoints

For endpoints requiring authentication:

```typescript
import { signJwt } from '@core/utils/jwt.js';

it('should return 401 when token is missing', async () => {
  const response = await app.request(
    new Request('http://localhost/protected/endpoint', {
      method: 'GET',
      // No Authorization header
    })
  );

  expect(response.status).toBe(401);
});

it('should return 200 with valid token', async () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const token = await signJwt(userId);

  const response = await app.request(
    new Request('http://localhost/protected/endpoint', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  );

  expect(response.status).toBe(200);
});
```

### Testing Endpoints with API Keys

For endpoints requiring API key authentication:

```typescript
import { config } from '@config/index.js';

it('should return 401 when API key is missing', async () => {
  const response = await app.request(
    new Request('http://localhost/api/endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'some-id' }),
    })
  );

  expect(response.status).toBe(401);
});

it('should return 200 with valid API key', async () => {
  const response = await app.request(
    new Request('http://localhost/api/endpoint', {
      method: 'POST',
      headers: {
        'x-api-key': config.API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'some-id' }),
    })
  );

  expect(response.status).toBe(200);
});
```

## Test Organization

Group tests by functionality:

```typescript
describe('POST /api/endpoint', () => {
  describe('Success cases', () => {
    it('should ...', () => {});
    it('should ...', () => {});
  });

  describe('Validation errors', () => {
    it('should ...', () => {});
  });

  describe('Authentication', () => {
    it('should ...', () => {});
  });

  describe('Error handling', () => {
    it('should ...', () => {});
  });
});
```

## Running Tests

```bash
# Run all integration tests
pnpm test:integration

# Run specific test file
pnpm test:integration -- test/integration/endpoint-name.test.ts

# Run tests in watch mode
pnpm test:integration --watch
```

## Best Practices

1. **One assertion per test**: Each test should verify one thing
2. **Clear test names**: Use descriptive names that explain what is being tested
3. **Arrange-Act-Assert**: Structure tests with setup, action, then verification
4. **Reuse test data**: Define common test data (UUIDs, tokens) at the file level
5. **Test edge cases**: Include tests for boundary conditions and edge cases
6. **Verify both happy and sad paths**: Test success and failure scenarios
7. **Use proper HTTP status codes**: Test the correct status codes for each scenario
