import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { ROUTES } from './paths.js';

const CallbackResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
});

const ErrorSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.OAUTH_CALLBACK,
  tags: ['mcp'],
  request: {},
  responses: {
    200: {
      content: { 'application/json': { schema: CallbackResponseSchema } },
      description: 'OAuth callback received',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Internal server error',
    },
  },
});

export function registerOAuthCallbackRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    try {
      const query = c.req.query();

      console.log('=== OAuth Callback Received ===');
      console.log('Query Parameters:', query);
      console.log('Headers:', {
        'content-type': c.req.header('content-type'),
        'user-agent': c.req.header('user-agent'),
        'authorization': c.req.header('authorization') ? '[REDACTED]' : 'undefined',
      });
      console.log('Full URL:', c.req.url);
      console.log('Method:', c.req.method);
      console.log('==============================');

      return c.json(
        {
          status: 'success',
          message: 'OAuth callback received and logged',
        },
        200
      );
    } catch (error) {
      console.error('Error in OAuth callback:', error);
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });
}
