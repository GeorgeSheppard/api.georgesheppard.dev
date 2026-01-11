import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { requests } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
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
      required: true
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

export function registerDeleteEmailRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { requestId } = c.req.valid('form');
    const { db } = c.get('databaseClient');

    await db
      .update(requests)
      .set({
        email: null,
        frequency: null,
        nextRecommendationUtc: null,
      })
      .where(eq(requests.id, requestId));

    return c.json({}, 200);
  });
}
