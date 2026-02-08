import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { clearRequestEmailFields } from '../../queries/recommendations.js';
import { ROUTES } from '../paths.js';

const BodySchema = z.object({
  requestId: z.string().uuid(),
});

const route = createRoute({
  method: 'post',
  path: ROUTES.DELETE_EMAIL,
  tags: ['recommendations'],
  request: {
    body: {
      content: {
        'application/x-www-form-urlencoded': {
          schema: BodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({}) } },
      description: 'Email removed successfully',
    },
    400: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Validation failed',
    },
  },
});

export async function deleteEmail(c: Context, requestId: string): Promise<Record<string, never>> {
  const { db } = c.get('databaseClient');
  await clearRequestEmailFields(db, requestId);
  return {};
}

export function registerDeleteEmailRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { requestId } = c.req.valid('form');
    const result = await deleteEmail(c, requestId);
    return c.json(result, 200);
  });
}
