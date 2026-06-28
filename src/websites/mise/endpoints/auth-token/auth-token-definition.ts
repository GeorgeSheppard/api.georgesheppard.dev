import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { AuthTokenResponseSchema } from './auth-token.js';

export const authTokenRoute = createRoute({
  method: 'post',
  path: '/mcp/auth/token',
  tags: ['mcp'],
  description: 'Exchange a Cognito JWT for a long-lived MCP JWT token',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AuthTokenResponseSchema,
        },
      },
      description: 'MCP JWT token generated successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Unauthorized - invalid or missing JWT',
    },
  },
});
