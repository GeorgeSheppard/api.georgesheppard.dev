import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { findRecommendationWithRequest } from '../../queries/recommendations.js';
import { ROUTES } from '../paths.js';
import type { Recommendation } from '@core/types/recommendation.js';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const RecommendationSchema = z
  .object({
    name: z.string(),
    author: z.string(),
    description: z.string(),
    reason: z.string(),
    amazonLink: z.string(),
  })
  .openapi('Recommendation');

const SuccessSchema = z.object({
  recommendations: z.array(RecommendationSchema).nullable(),
  hasEmail: z.boolean(),
  isRecurringMonthly: z.boolean(),
  success: z.literal(true),
});

const ErrorSchema = z.object({
  error: z.string(),
  success: z.literal(false),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.GET_RECOMMENDATION_BY_ID,
  tags: ['recommendations'],
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessSchema } },
      description: 'Recommendation retrieved successfully',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Recommendation not found',
    },
    422: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Unable to create recommendations',
    },
  },
});

export type GetByIdSuccess = {
  recommendations: Recommendation[] | null;
  hasEmail: boolean;
  isRecurringMonthly: boolean;
  success: true;
};

export type GetByIdError = {
  error: string;
  success: false;
};

export type GetByIdResult =
  | { status: 200; body: GetByIdSuccess }
  | { status: 404; body: GetByIdError }
  | { status: 422; body: GetByIdError };

export async function getById(c: Context, id: string): Promise<GetByIdResult> {
  const { db } = c.get('databaseClient');
  const recommendation = await findRecommendationWithRequest(db, id);

  if (!recommendation) {
    return { status: 404, body: { error: 'Recommendation not found', success: false } };
  }

  if (
    recommendation.processedUtc &&
    (!recommendation.recommendations || recommendation.recommendations.length === 0)
  ) {
    return {
      status: 422,
      body: {
        error:
          "We couldn't create any recommendations for you. Please make sure your bookshelf is readable.",
        success: false,
      },
    };
  }

  return {
    status: 200,
    body: {
      recommendations: recommendation.recommendations,
      hasEmail: !!recommendation.email,
      isRecurringMonthly: !!recommendation.frequency,
      success: true,
    },
  };
}

export function registerGetByIdRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { id } = c.req.valid('param');
    const result = await getById(c, id);

    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 404:
        return c.json(result.body, 404);
      case 422:
        return c.json(result.body, 422);
    }
  });
}
