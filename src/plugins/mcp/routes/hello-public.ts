import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { ROUTES } from './paths.js';

const ResponseSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.HELLO,
  tags: ['mcp'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ResponseSchema,
        },
      },
      description: 'Public hello endpoint for MCP server',
    },
  },
});

export function registerHelloPublicRoute(app: OpenAPIHono) {
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
