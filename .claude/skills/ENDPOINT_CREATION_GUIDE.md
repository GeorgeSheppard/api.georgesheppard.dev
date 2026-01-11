---
name: endpoint creator
description: Creating and maintaining HTTP endpoints according to best practices
---

# Endpoint Creation Guide

This guide establishes the patterns and best practices for creating HTTP endpoints in this Hono/Zod-OpenAPI application. An AI assistant should follow this checklist to implement high-quality endpoints without additional input.

## Endpoint Checklist

### 1. Add Route Path to ROUTES Constant
**File**: `src/websites/shelfie/routes/paths.ts`

Define the new endpoint path in the centralized `ROUTES` object using Hono's OpenAPI path format with curly braces for path parameters.

```typescript
export const ROUTES = {
  // ... existing routes ...
  UPDATE_RECOMMENDATION: '/api/recommendations/{id}',
} as const;
```

**Key Points**:
- All route paths must be centralized in this file
- Use RESTful naming conventions
- Use curly braces `{id}` for path parameters, not colons
- Export as `as const` for type safety

---

### 2. Create Route Handler File
**File**: `src/websites/shelfie/routes/recommendations/[endpoint-name].ts`

Create a new TypeScript file in the appropriate routes directory (e.g., `recommendations/`, `emails/`).

---

### 3. Define Request Schema with Zod
Define a Zod schema for request body validation. Be explicit about all required fields and their types.

```typescript
import { z } from '@hono/zod-openapi';

const BodySchema = z.object({
  requestId: z.string().uuid(),
  email: z.string().email(),
});
```

**Key Points**:
- Import from `@hono/zod-openapi`, not plain `zod`
- Use Zod's built-in validators (`.uuid()`, `.email()`, etc.)
- Document field constraints in the schema itself
- Each field should have appropriate validation

---

### 4. Create Route Definition with createRoute
Define the OpenAPI route specification using `createRoute()` from `@hono/zod-openapi`.

```typescript
import { createRoute, z } from '@hono/zod-openapi';
import { ROUTES } from '../paths.js';

const route = createRoute({
  method: 'post',  // or 'get', 'put', 'delete', etc.
  path: ROUTES.YOUR_ENDPOINT,
  tags: ['recommendations'],  // or appropriate category
  request: {
    body: {
      content: {
        'application/x-www-form-urlencoded': {
          schema: BodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({
        // Define success response shape
        id: z.string().uuid(),
      }) } },
      description: 'Descriptive success message',
    },
    400: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Validation failed',
    },
  },
});
```

**Key Points**:
- Always specify `content-type` in request body (use `'application/x-www-form-urlencoded'` for form data)
- Set `required: true` for required request bodies
- Define success response (200) with explicit schema
- Define error response (400) for validation failures
- Include descriptive messages for each response status
- Use `tags` to organize endpoints in Swagger documentation
- For endpoints that always return empty objects, use `z.object({})`

---

### 5. Create Handler Function with Export
Create a registration function that registers the route with the app and implements the handler logic.

```typescript
import { OpenAPIHono } from '@hono/zod-openapi';

export function registerYourEndpointRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    // 1. Extract and validate request data
    const { requestId, email } = c.req.valid('form');

    // 2. Get clients from context
    const { db } = c.get('databaseClient');
    const queueClient = c.get('queueClient');

    // 3. Perform database operations
    await db
      .update(requests)
      .set({ email, updatedUtc: new Date() })
      .where(eq(requests.id, requestId));

    // 4. Return response
    return c.json({ id: requestId }, 200);
  });
}
```

**Key Points**:
- Function name should follow pattern: `register[EndpointName]Route`
- Use `c.req.valid('form')` to extract and validate form data (Zod validation happens automatically)
- Get database client with `c.get('databaseClient')` and extract the `db` property
- Get queue client with `c.get('queueClient')` if needed for async operations
- Always specify the HTTP status code in `c.json()` return (e.g., `200`, `201`)
- Use imported database tables (e.g., `requests`, `recommendations`) for queries
- Use drizzle-orm methods: `.update()`, `.insert()`, `.select()`, `.delete()`, `.where()`
- Use `eq()` from drizzle-orm for WHERE clause comparisons

---

### 6. Import Database Tables and ORM Utilities
```typescript
import { requests } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
```

**Key Points**:
- Import specific tables from `@core/database/schema/index.js`
- Import comparison operators from `drizzle-orm` (e.g., `eq`, `gt`, `lt`)
- Available tables: `requests`, `images`, `recommendations`

---

### 7. Register Route in Route Index File
**File**: `src/websites/shelfie/routes/index.ts`

Add the registration function to the main route registration file.

```typescript
import { registerYourEndpointRoute } from './recommendations/your-endpoint.js';

export function registerShelfieRoutes(app: OpenAPIHono) {
  registerYourEndpointRoute(app);
  // ... other route registrations ...
}
```

**Key Points**:
- Import the registration function from the endpoint file
- Call the function within `registerShelfieRoutes()`
- Routes must be registered before OpenAPI documentation generation

---

### 8. Use Consistent Content-Type
For form-based endpoints, always use `'application/x-www-form-urlencoded'` in both:
- Route definition (`createRoute()`)
- Test request headers (`'Content-Type': 'application/x-www-form-urlencoded'`)

```typescript
// In route definition
'application/x-www-form-urlencoded': {
  schema: BodySchema,
}

// In request extraction
const data = c.req.valid('form');
```

**Key Points**:
- This format is consistent with HTML form submissions
- Validation happens automatically via the schema defined in `createRoute()`
- The schema must match the form-data being sent

---

### 9. Error Handling
Errors are handled globally by the centralized `errorHandler` middleware. Do not catch errors in route handlers unless you need custom logic.

```typescript
// ❌ Don't do this - let the middleware handle it
try {
  await db.update(...)
} catch (error) {
  return c.json({ error: 'Something went wrong' }, 500);
}

// ✅ Zod validation errors are caught automatically
// If validation fails, a 400 response with error details is returned
```

**Key Points**:
- Validation errors from Zod schemas are automatically caught and formatted
- Database errors are caught by centralized error handler
- Only add try-catch for non-happy-path scenarios that need special handling

---

### 10. Database Operations Pattern
Use this pattern for all database operations:

```typescript
// For UPDATE
await db
  .update(requests)
  .set({ email: null, frequency: null })
  .where(eq(requests.id, requestId));

// For INSERT
const result = await db
  .insert(requests)
  .values({ email: 'test@example.com' })
  .returning();

// For SELECT
const records = await db
  .select()
  .from(requests)
  .where(eq(requests.id, requestId));

// For DELETE
await db
  .delete(requests)
  .where(eq(requests.id, requestId));
```

**Key Points**:
- Always use the table constant (not string names)
- Use `where()` with comparison operators from drizzle-orm
- Use `.returning()` for INSERT to get created records
- Chain methods for readability
- All operations are awaited

---

### 11. Using Transactions
Use transactions to wrap multiple **mutations** (INSERT, UPDATE, DELETE) across different tables that must succeed or fail together as a unit. Transactions ensure data consistency and prevent partial updates. Single mutations to a single table do not require transactions. Keep **read operations** (SELECT) outside the transaction for cleaner code and simpler error handling.

```typescript
export function registerYourEndpointRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { db } = c.get('databaseClient');
    const id = c.req.valid('form').id;

    // 1. Perform read operations OUTSIDE transaction
    const [record] = await db
      .select()
      .from(requests)
      .where(eq(requests.id, id))
      .limit(1);

    if (!record) {
      return c.json({ error: 'Record not found', success: false }, 404);
    }

    // 2. Wrap only mutations in a transaction
    await db.transaction(async (tx) => {
      // Update operation
      await tx
        .update(requests)
        .set({ email: 'newemail@example.com' })
        .where(eq(requests.id, id));

      // Insert operation
      await tx
        .insert(images)
        .values({
          requestId: id,
          image: file.data,
        });

      // Return if needed
      return { updated: true };
    });

    // 3. Handle external operations AFTER transaction commits
    const queueClient = c.get('queueClient');
    try {
      queueClient.channel.sendToQueue(
        queueClient.queue,
        Buffer.from(JSON.stringify({ id })),
        { persistent: true }
      );
    } catch (error) {
      return c.json({ error: 'Failed to queue operation', success: false }, 500);
    }

    return c.json({ success: true }, 200);
  });
}
```

**Key Points**:
- Perform **SELECT queries outside the transaction** - this allows you to validate data and return errors directly
- **Use transactions only for multiple mutations across different tables** - do not wrap single mutations to a single table
- When using transactions, wrap **only mutations (INSERT, UPDATE, DELETE)** - use `db.transaction(async (tx) => { ... })`
- Replace `db` with `tx` inside the transaction callback for mutation operations
- Validate data from SELECTs and return errors before entering the transaction
- Use `Promise.all()` to parallelize independent mutations within the transaction for better performance:
  ```typescript
  await Promise.all([
    tx.insert(recommendations).values(...).returning(),
    tx.insert(images).values(...),
  ]);
  ```
- Handle queue messages and other external operations **after** the transaction commits successfully
- If an external operation (like queue send) fails, return an error so the client can retry
- This pattern keeps error handling clean and avoids unnecessary nested try-catch blocks

---

## Summary Checklist

- [ ] Route path added to `ROUTES` in `paths.ts`
- [ ] New endpoint file created in appropriate route directory
- [ ] Zod schema defined for request body with appropriate validators
- [ ] `createRoute()` defines method, path, tags, request, and responses
- [ ] All response statuses (200, 400) have explicit schemas and descriptions
- [ ] `registerYourEndpointRoute()` function created and exported
- [ ] Handler extracts data with `c.req.valid('form')`
- [ ] Handler gets clients from context: `c.get('databaseClient')`, `c.get('queueClient')`
- [ ] Database operations use drizzle-orm with proper syntax
- [ ] Response returned with `c.json()` and explicit status code
- [ ] Route registered in `registerShelfieRoutes()` in `index.ts`
- [ ] Content-Type consistently uses `'application/x-www-form-urlencoded'`
- [ ] Endpoint will be documented in Swagger UI via OpenAPI schema
