import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { updateCustomPreferences } from '../../queries/recommendations.js';
import { sanitizeCustomPreferences } from '@core/utils/openai-recommender.js';
import { ROUTES } from '../paths.js';

const ParamsSchema = z.object({
  requestId: z.string().uuid(),
});

const BodySchema = z.object({
  customPreferences: z.string().max(2000).optional(),
});

const SuccessSchema = z.object({ success: z.literal(true) });

const route = createRoute({
  method: 'post',
  path: ROUTES.UPDATE_PROFILE_PREFERENCES,
  tags: ['profile'],
  request: {
    params: ParamsSchema,
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
      content: { 'application/json': { schema: SuccessSchema } },
      description: 'Preferences updated successfully',
    },
  },
});

export async function updateProfilePreferences(
  c: Context,
  requestId: string,
  customPreferences: string | undefined
): Promise<{ success: true }> {
  const { db } = c.get('databaseClient');
  // Preferences are free text supplied directly by the end user and are fed into the
  // recommendation prompt later, so this stores the trimmed/sanitized form up front — the
  // recommender still treats the stored value as untrusted, delimited data, never instructions.
  await updateCustomPreferences(db, requestId, sanitizeCustomPreferences(customPreferences));
  return { success: true };
}

export function registerUpdatePreferencesRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { requestId } = c.req.valid('param');
    const { customPreferences } = c.req.valid('form');
    const result = await updateProfilePreferences(c, requestId, customPreferences);
    return c.json(result, 200);
  });
}
