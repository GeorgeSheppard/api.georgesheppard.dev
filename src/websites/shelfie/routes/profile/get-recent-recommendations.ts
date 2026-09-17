import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import {
  findRecentRecommendationsForRequest,
  findRequestById,
} from '../../queries/recommendations.js';
import { ROUTES } from '../paths.js';

const RECENT_RECOMMENDATIONS_LIMIT = 5;

const ParamsSchema = z.object({
  requestId: z.string().uuid(),
});

const RecommendationSummarySchema = z.object({
  id: z.string().uuid(),
  createdUtc: z.string().datetime(),
  processedUtc: z.string().datetime().nullable(),
});

const SuccessSchema = z.object({
  recommendations: z.array(RecommendationSummarySchema),
  success: z.literal(true),
});

const ErrorSchema = z.object({
  error: z.string(),
  success: z.literal(false),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.GET_PROFILE_RECOMMENDATIONS,
  tags: ['profile'],
  request: { params: ParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessSchema } },
      description: 'Recent recommendations retrieved successfully',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Request not found',
    },
  },
});

export type RecommendationSummaryBody = {
  id: string;
  createdUtc: string;
  processedUtc: string | null;
};

export type GetRecentRecommendationsResult =
  | { status: 200; body: { recommendations: RecommendationSummaryBody[]; success: true } }
  | { status: 404; body: { error: string; success: false } };

export async function getRecentRecommendations(
  c: Context,
  requestId: string
): Promise<GetRecentRecommendationsResult> {
  const { db } = c.get('databaseClient');
  const request = await findRequestById(db, requestId);

  if (!request) {
    return { status: 404, body: { error: 'Request not found', success: false } };
  }

  const rows = await findRecentRecommendationsForRequest(
    db,
    requestId,
    RECENT_RECOMMENDATIONS_LIMIT
  );

  return {
    status: 200,
    body: {
      recommendations: rows.map((row) => ({
        id: row.id,
        createdUtc: row.createdUtc.toISOString(),
        processedUtc: row.processedUtc ? row.processedUtc.toISOString() : null,
      })),
      success: true,
    },
  };
}

export function registerGetRecentRecommendationsRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { requestId } = c.req.valid('param');
    const result = await getRecentRecommendations(c, requestId);

    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 404:
        return c.json(result.body, 404);
    }
  });
}
