# Integration Tests Setup

This directory contains integration tests for the Shelfie API backend. Tests use **testcontainers** to spin up PostgreSQL and RabbitMQ containers for each test run.

## How it Works

### Test Infrastructure

1. **Environment Loading** (`vitest.config.ts`):
   - Loads `.env.test` before tests run
   - All config is in process.env (credentials, URLs, API keys, etc.)

2. **Container Setup** (`test/setup.ts`):
   - Starts PostgreSQL container (binds to localhost:5432)
   - Starts RabbitMQ container (binds to localhost:5672)
   - **No process.env modifications** - containers bind to ports in `.env.test`
   - Keeps container references for cleanup only
   - Stops containers after tests

3. **Server Initialization**:
   - Each test creates a fresh server instance via `createServer()`
   - Server reads DATABASE_URL, RABBITMQ_HOST, RABBITMQ_PORT from process.env
   - Server connects to the running containers
   - Server runs migrations on startup
   - All database clients, queue clients, and middleware are initialized by the server
   - Tests interact with the server only via HTTP requests

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run specific test file
pnpm test example.test.ts

# Run with coverage
pnpm test --coverage
```

## Writing Integration Tests

Tests are simple: create the server, make HTTP requests, and assert responses.

### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { createServer } from '../../src/server.js';

describe('My Feature', () => {
  it('should return data', async () => {
    // Create server (with all clients, migrations, middleware)
    const { app } = await createServer();

    // Make HTTP request - that's it!
    const res = await app.request(
      new Request('http://localhost:3000/api/endpoint', {
        method: 'GET',
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.someField).toBeDefined();
  });
});
```

### Testing API Endpoints with Form Data

```typescript
it('should handle POST request with form data', async () => {
  const { app } = await createServer();

  const res = await app.request(
    new Request('http://localhost:3000/api/recommendations/add-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        id: 'recommendation-id',
        email: 'test@example.com',
        recurring: 'true',
      }).toString(),
    })
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
});
```

### Testing with JSON Request Body

```typescript
it('should handle JSON POST request', async () => {
  const { app } = await createServer();

  const res = await app.request(
    new Request('http://localhost:3000/api/endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test',
        value: 123,
      }),
    })
  );

  expect(res.status).toBe(200);
});
```

### Testing Queue Operations

Since RabbitMQ is running during tests, you can test endpoints that queue jobs:

```typescript
it('should queue a text extraction job', async () => {
  const { app } = await createServer();

  const formData = new FormData();
  formData.append('images', new Blob(['test'], { type: 'image/jpeg' }), 'test.jpg');

  const res = await app.request(
    new Request('http://localhost:3000/api/recommendations/from-bookcase', {
      method: 'POST',
      body: formData,
    })
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.id).toBeDefined();
  // Job was queued to real RabbitMQ!
});
```

### Database Cleanup

Between tests, the database and queues are fresh. The test containers are ephemeral so cleanup is automatic.

## Key Features

- ✅ Clean test structure - just create server and make HTTP requests
- ✅ Fresh database for each test run
- ✅ Fresh message queues for each test run
- ✅ Full stack testing (PostgreSQL + RabbitMQ + API)
- ✅ Automatic schema creation with migrations
- ✅ Real queue operations during tests
- ✅ No manual setup needed (Docker-based testcontainers)
- ✅ Compatible with existing Drizzle ORM and amqplib setup

## Troubleshooting

### Docker not running
If you see connection errors, ensure Docker is running:
```bash
docker ps
```

### Timeout errors
If tests timeout during setup, it may be because containers are taking too long to start. The setup has a 120-second timeout. You can increase it in `vitest.config.ts`:
```typescript
test: {
  testTimeout: 60000, // Test timeout
  hookTimeout: 120000, // Setup/teardown timeout
}
```

### Container connection issues
The testcontainers are ephemeral (PostgreSQL data in tmpfs, RabbitMQ queues temporary). If you see connection errors:
1. Ensure Docker is running
2. Check available disk space (tmpfs needs space)
3. Restart Docker if containers don't start

### RabbitMQ queue issues
If tests fail to queue jobs or connect to RabbitMQ:
- Verify `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD` are set by test setup
- Increase hook timeout if RabbitMQ container is slow to start
- Check Docker logs: `docker logs <container-id>`

## File Structure

```
test/
├── setup.ts              # Test infrastructure setup
├── integration/
│   └── example.test.ts   # Example test
└── README.md             # This file
```

## Next Steps

1. Look at `test/integration/example.test.ts` for basic examples
2. Create test files for each feature in `test/integration/`
3. Import and use `createServer()` in your tests
4. Make HTTP requests to test your endpoints
