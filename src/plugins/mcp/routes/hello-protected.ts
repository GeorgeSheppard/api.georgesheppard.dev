import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.js';
import { ROUTES } from './paths.js';
import { handleProtectedHello } from './handlers.js';
import { ProtectedHelloResponseSchema, ErrorResponseSchema } from './schemas.js';

const route = createRoute({
  method: 'get',
  path: ROUTES.HELLO_PROTECTED,
  tags: ['mcp'],
  security: [{ bearerAuth: [] }],
  middleware: jwtAuthMiddleware,
  request: {
    headers: z.object({
      Authorization: z.string().describe('Bearer token for authentication'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ProtectedHelloResponseSchema,
        },
      },
      description: 'Protected hello endpoint with user ID',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Unauthorized - invalid or missing JWT',
    },
  },
});

export function registerHelloProtectedRoute(app: OpenAPIHono) {
  app.openapi(route, handleProtectedHello);
}
