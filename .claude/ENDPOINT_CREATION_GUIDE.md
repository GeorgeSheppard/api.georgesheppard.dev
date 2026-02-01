# Endpoint Creation Guide

This guide defines the standard structure and patterns for creating endpoints in this Hono application.

## File Organization

Each endpoint is organized into a dedicated directory with the following structure:

```
src/websites/{website}/endpoints/{endpoint-name}/
├── {endpoint-name}-definition.ts    # Route definition and request schema
├── {endpoint-name}.ts               # Handler function and response schema
```

## File Responsibilities

### `{endpoint-name}-definition.ts`

This file contains the OpenAPI route definition and request schema. It imports the response schema from the handler file to avoid circular dependencies.

**Contents:**
- Request schema (Zod object)
- OpenAPI route definition (created with `createRoute`)
- Request type (inferred from request schema)
- Any middleware configuration

**Example:**
```typescript
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { myMiddleware } from '@core/middleware/my-middleware.js';
import { MyResponseSchema } from './my-endpoint.js';

export const MyRequestSchema = z.object({
  // ... request fields
});

export type MyRequest = z.infer<typeof MyRequestSchema>;

export const myEndpointRoute = createRoute({
  method: 'post',
  path: '/my/endpoint',
  tags: ['my-tag'],
  middleware: myMiddleware,
  request: {
    body: {
      content: {
        'application/json': {
          schema: MyRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MyResponseSchema,
        },
      },
      description: 'Success response',
    },
    // ... other responses
  },
});
```

### `{endpoint-name}.ts`

This file contains the handler function and response schema. This file should be kept focused on business logic.

**Contents:**
- Response schema (Zod object)
- Response type (inferred from response schema)
- Handler function

**Example:**
```typescript
import { Context } from 'hono';
import { z } from 'zod';

export const MyResponseSchema = z.object({
  message: z.string(),
  // ... response fields
});

export type MyResponse = z.infer<typeof MyResponseSchema>;

/**
 * Handler function for my endpoint
 */
export async function myEndpoint(c: Context): Promise<MyResponse> {
  // Handler logic here
  return {
    message: 'Success',
    // ... response data
  };
}
```

## Route Registration

Endpoints are registered in the website's `index.ts` file:

```typescript
import { OpenAPIHono } from '@hono/zod-openapi';
import { myEndpoint } from './endpoints/my-endpoint/my-endpoint.js';
import { myEndpointRoute } from './endpoints/my-endpoint/my-endpoint-definition.js';
import { myMiddleware } from '@core/middleware/my-middleware.js';

export function registerRoutes(app: OpenAPIHono) {
  app.openapi(myEndpointRoute, async (c) => {
    const { field } = c.req.valid('json');
    const result = await myEndpoint(c);
    return c.json(result, 200);
  });
}
```

## Key Principles

1. **Separation of Concerns**: Keep route definitions separate from handler logic
2. **Avoid Circular Dependencies**: The definition file imports from the handler file, never the other way around
3. **Type Safety**: Use Zod schemas to infer types rather than declaring them manually
4. **Reusability**: Handlers should be pure functions that can be tested independently
5. **Middleware**: Apply middleware at the route definition level for clear intent

## Type-Safe Context

For endpoints requiring authentication or specific context variables, use properly typed context:

```typescript
import { ContextWithUserId } from '@core/types/context.js';

export async function protectedEndpoint(c: ContextWithUserId): Promise<MyResponse> {
  const userId = c.get('userId'); // TypeScript knows userId exists
  // ...
}
```

## Response Validation

Always validate responses using Zod schemas. This ensures:
- Runtime type checking
- OpenAPI documentation accuracy
- Consistent error handling

The response schema should reflect the actual HTTP response body, not internal types.
