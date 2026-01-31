import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.js';
import { ROUTES } from './paths.js';

const ResponseSchema = z.object({
  message: z.string(),
  userId: z.string().uuid(),
  timestamp: z.string(),
});

const ErrorSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.HELLO_PROTECTED,
  tags: ['mcp'],
  security: [{ bearerAuth: [] }],
  middleware: jwtAuthMiddleware,
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ResponseSchema,
        },
      },
      description: 'Protected hello endpoint with user ID',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Unauthorized - invalid or missing JWT',
    },
  },
});

export function registerHelloProtectedRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const userId = c.get('userId') as string;

    return c.json(
      {
        message: 'Hello from MCP protected endpoint!',
        userId,
        timestamp: new Date().toISOString(),
      },
      200
    );
  });
}
