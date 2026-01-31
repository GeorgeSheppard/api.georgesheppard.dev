import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '@core/middleware/auth.js';
import { signJwt } from '@core/utils/jwt.js';
import { ROUTES } from './paths.js';

const RequestSchema = z.object({
  userId: z.string().uuid().describe('User ID as UUID'),
});

const ResponseSchema = z.object({
  token: z.string().describe('JWT token'),
  userId: z.string().uuid().describe('User ID'),
});

const ErrorSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: 'post',
  path: ROUTES.AUTH_TOKEN,
  tags: ['mcp'],
  security: [{ apiKey: [] }],
  middleware: authMiddleware,
  request: {
    body: {
      content: {
        'application/json': {
          schema: RequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ResponseSchema,
        },
      },
      description: 'JWT token generated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Invalid request body',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Unauthorized - invalid API key',
    },
  },
});

export function registerAuthTokenRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { userId } = c.req.valid('json');

    const token = await signJwt(userId);

    return c.json(
      {
        token,
        userId,
      },
      200
    );
  });
}
