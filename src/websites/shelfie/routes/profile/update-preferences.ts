import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import {
  updateCustomPreferences,
  createRecommendationForRequest,
} from '../../queries/recommendations.js';
import { sanitizeCustomPreferences } from '@core/utils/openai-recommender.js';
import { moderateCustomPreferences } from '@core/utils/preferences-moderator.js';
import { enqueueRecommendationJob } from '@core/queue/client.js';
import { ROUTES } from '../paths.js';
import { logger } from '@core/telemetry/logger.js';

const ParamsSchema = z.object({
  requestId: z.string().uuid(),
});

const BodySchema = z.object({
  customPreferences: z.string().max(2000).optional(),
});

const SuccessSchema = z.object({ recommendationId: z.string().uuid(), success: z.literal(true) });
const ErrorSchema = z.object({ error: z.string(), success: z.literal(false) });

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
      description: 'Preferences updated and recommendations queued for regeneration',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: "Preferences don't look like a reading preference",
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Failed to queue recommendation processing',
    },
  },
});

export type UpdatePreferencesResult =
  | { status: 200; body: { recommendationId: string; success: true } }
  | { status: 400; body: { error: string; success: false } }
  | { status: 500; body: { error: string; success: false } };

export async function updateProfilePreferences(
  c: Context,
  requestId: string,
  customPreferences: string | undefined
): Promise<UpdatePreferencesResult> {
  const { db } = c.get('databaseClient');
  const sanitized = sanitizeCustomPreferences(customPreferences);

  if (sanitized) {
    // A light model gate before anything is stored: reject text that isn't a genuine reading
    // preference (off-topic, abusive, or an attempt to instruct/inject). This is defense in
    // depth, not a replacement for the untrusted-data framing still applied when the (now
    // vetted) text is later placed into the main recommendation prompt.
    const openaiClient = c.get('openaiClient');
    const moderation = await moderateCustomPreferences(openaiClient.getClient(), sanitized);
    if (!moderation.allowed) {
      return {
        status: 400,
        body: {
          error:
            "That doesn't look like a reading preference we can use. Try describing genres, authors, moods or themes you want more or less of.",
          success: false,
        },
      };
    }
  }

  await updateCustomPreferences(db, requestId, sanitized);

  // Saving preferences is the user asking for updated recommendations right now, not just
  // storing a setting for next time — so regenerate immediately.
  const recommendation = await createRecommendationForRequest(db, requestId);

  const queueClient = c.get('queueClient');
  try {
    enqueueRecommendationJob(queueClient, {
      userId: requestId,
      recommendationId: recommendation.id,
    });
  } catch (error) {
    logger.error('Failed to queue recommendation regeneration after updating preferences:', error);
    return {
      status: 500,
      body: { error: 'Failed to queue recommendation processing', success: false },
    };
  }

  return { status: 200, body: { recommendationId: recommendation.id, success: true } };
}

export function registerUpdatePreferencesRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { requestId } = c.req.valid('param');
    const { customPreferences } = c.req.valid('form');
    const result = await updateProfilePreferences(c, requestId, customPreferences);

    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 400:
        return c.json(result.body, 400);
      case 500:
        return c.json(result.body, 500);
    }
  });
}
