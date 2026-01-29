import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { ROUTES } from './paths.js';
import { mcpAuthMiddleware } from '@core/middleware/mcp-auth.js';

const SuccessSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
});

const ErrorSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.MCP_HELLO,
  tags: ['mcp'],
  middleware: [mcpAuthMiddleware()] as const,
  request: {},
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessSchema } },
      description: 'Hello response',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Unauthorized',
    },
  },
});

export function registerMcpHelloRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    return c.json(
      {
        message: 'Hello from MCP!',
        timestamp: new Date().toISOString(),
      },
      200
    );
  });
}
