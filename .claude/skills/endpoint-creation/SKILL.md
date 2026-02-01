---
name: endpoint-creation
description: Creating and maintaining endpoints (HTTP and MCP) according to best practices
---

# Endpoint Creation Guide

This guide defines the standard structure and patterns for creating endpoints in this Hono application. Endpoints are designed to be reusable across both HTTP and MCP (Model Context Protocol) interfaces.

## Architecture Overview

Endpoints are split into three layers:

1. **Handler** - Pure business logic, agnostic to HTTP/MCP
2. **Validator** - Zod schemas for request/response validation
3. **Route Definition** - HTTP-specific route definition and registration

This separation allows handlers to be reused in both HTTP endpoints and MCP server implementations.

## File Organization

Each endpoint is organized into a dedicated directory with the following structure:

```
src/websites/{website}/endpoints/{endpoint-name}/
├── {endpoint-name}.ts               # Handler function and schemas
├── {endpoint-name}-definition.ts    # HTTP route definition (Hono/OpenAPI)
├── {endpoint-name}.integration.test.ts  # Integration tests
```

## File Responsibilities

### `{endpoint-name}.ts` - Handler and Schemas

This file contains the core business logic handler and validation schemas. The handler should accept only the data it needs, not the Hono context directly. This makes it reusable across HTTP and MCP.

**Contents:**

- Request schema (Zod object)
- Response schema (Zod object)
- Type exports (inferred from schemas)
- Handler function (business logic only)

**Example:**

```typescript
import { z } from 'zod';
import { signJwt } from '@core/utils/jwt.js';

export const AuthTokenRequestSchema = z.object({
  userId: z.string().uuid().describe('User ID as UUID'),
});

export const AuthTokenResponseSchema = z.object({
  token: z.string().describe('JWT token'),
  userId: z.string().uuid().describe('User ID'),
});

export type AuthTokenRequest = z.infer<typeof AuthTokenRequestSchema>;
export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;

/**
 * Auth token handler - pure business logic
 * Can be reused in HTTP endpoints and MCP servers
 */
export async function authTokenHandler(request: AuthTokenRequest): Promise<AuthTokenResponse> {
  const token = await signJwt(request.userId);

  return {
    token,
    userId: request.userId,
  };
}
```

**Key Points:**

- Handler accepts only the data it needs (not Hono Context)
- Handler returns the response data directly
- No HTTP status codes or headers in the handler
- Both request and response schemas are defined here
- This file is agnostic to HTTP/MCP, making it reusable

### `{endpoint-name}-definition.ts` - HTTP Route Definition

This file contains the OpenAPI route definition specific to HTTP/Hono. It imports schemas from the handler file and wraps the handler with HTTP-specific logic.

**Contents:**

- Route definition (created with `createRoute`)
- Middleware configuration
- Route registration function that wraps the handler

**Example:**

```typescript
import { createRoute } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { authMiddleware } from '@core/middleware/auth.js';
import { AuthTokenRequestSchema, AuthTokenResponseSchema, authTokenHandler } from './auth-token.js';

export const authTokenRoute = createRoute({
  method: 'post',
  path: '/mcp/auth/token',
  tags: ['mcp'],
  security: [{ apiKey: [] }],
  middleware: authMiddleware,
  request: {
    headers: z.object({
      'x-api-key': z.string().describe('API key for authentication'),
    }),
    body: {
      content: {
        'application/json': {
          schema: AuthTokenRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AuthTokenResponseSchema,
        },
      },
      description: 'JWT token generated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Invalid request body',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Unauthorized - invalid API key',
    },
  },
});

/**
 * Register the auth token route with the Hono app
 */
export function registerAuthTokenRoute(app: OpenAPIHono) {
  app.openapi(authTokenRoute, async (c) => {
    const request = c.req.valid('json');
    const response = await authTokenHandler(request);
    return c.json(response, 200);
  });
}
```

**Key Points:**

- Imports schemas and handler from the handler file
- `createRoute` defines OpenAPI specification and middleware
- `registerAuthTokenRoute` function wraps the handler with HTTP context
- Extracts validated data from Hono context
- Calls the pure handler function
- Returns HTTP response with status code

## Route Registration

Endpoints are registered in the website's main route file (e.g., `index.ts`):

```typescript
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerAuthTokenRoute } from './endpoints/auth-token/auth-token-definition.js';

export function registerRoutes(app: OpenAPIHono) {
  registerAuthTokenRoute(app);
  // ... other routes
}
```

## MCP Server Integration

Handlers can be reused in MCP server implementations without modification. The MCP server imports the handler and schemas directly:

```typescript
// In your MCP server setup
import {
  AuthTokenRequestSchema,
  AuthTokenResponseSchema,
  authTokenHandler,
} from '@websites/kitchencalm/endpoints/auth-token/auth-token.js';

// Register handler in MCP server (example)
mcpServer.setRequestHandler(AuthTokenRequest, async (request) => {
  const validated = AuthTokenRequestSchema.parse(request);
  return await authTokenHandler(validated);
});
```

**Key Points:**

- MCP servers import from the handler file, not the definition file
- No HTTP-specific code in the handler
- Schemas work for both HTTP validation and MCP type checking
- No status codes or HTTP headers needed

## Key Principles

1. **Separation of Concerns**: Keep handlers separate from HTTP/MCP integration layers
2. **Reusability**: Handlers are pure functions that work with HTTP, MCP, and tests
3. **No Circular Dependencies**: Definition files import from handler files, never the other way around
4. **Type Safety**: Use Zod schemas to infer types rather than declaring them manually
5. **Middleware**: Apply middleware at the route definition level for clear intent
6. **Handler Purity**: Handlers accept only needed data, not Hono Context or HTTP details

## Testing Handlers

Handlers can be tested directly without HTTP context:

```typescript
import { describe, it, expect } from 'vitest';
import { authTokenHandler } from './auth-token.js';

describe('authTokenHandler', () => {
  it('should generate a valid JWT token', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const result = await authTokenHandler({ userId });

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('userId', userId);
  });
});
```

## Response Validation

Always validate responses using Zod schemas. This ensures:

- Runtime type checking
- OpenAPI documentation accuracy
- Consistent error handling across HTTP and MCP
- Single source of truth for request/response shapes

The schemas should reflect the actual data contract between client and server, independent of HTTP or MCP.
