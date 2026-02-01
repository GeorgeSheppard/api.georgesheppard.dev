import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authMiddleware } from '@core/middleware/auth.js';
import { AuthTokenResponseSchema } from './auth-token.js';

export const AuthTokenRequestSchema = z.object({
  userId: z.string().uuid().describe('User ID as UUID'),
});

export const authTokenRoute = createRoute({
  method: 'post',
  path: '/mcp/auth/token',
  tags: ['mcp'],
  security: [{ apiKey: [] }],
  middleware: authMiddleware,
  request: {
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
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Invalid request body',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Unauthorized - invalid API key',
    },
  },
});
