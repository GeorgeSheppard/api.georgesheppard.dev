import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { recommendations, requests } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { ROUTES } from '../paths.js';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const RecommendationSchema = z.object({
  name: z.string(),
  author: z.string(),
  description: z.string(),
  reason: z.string(),
  amazonLink: z.string(),
});

const SuccessSchema = z.object({
  recommendations: z.array(RecommendationSchema).nullable(),
  hasEmail: z.boolean(),
  isRecurringMonthly: z.boolean(),
  success: z.literal(true)
});

const ErrorSchema = z.object({
  error: z.string(),
  success: z.literal(false)
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

export function registerGetByIdRoute(app: OpenAPIHono) {
  app.openapi(
    route,
    async (c) => {
      const { id } = c.req.valid('param');
      const { db } = c.get('databaseClient');

      const result = await db
        .select({
          recommendations: recommendations.recommendations,
          processedUtc: recommendations.processedUtc,
          email: requests.email,
          frequency: requests.frequency,
        })
        .from(recommendations)
        .innerJoin(requests, eq(recommendations.requestId, requests.id))
        .where(eq(recommendations.id, id))
        .limit(1);

      if (result.length === 0) {
        return c.json({ error: 'Recommendation not found', success: false }, 404);
      }

      const recommendation = result[0];

      if (
        recommendation.processedUtc &&
        (!recommendation.recommendations || recommendation.recommendations.length === 0)
      ) {
        return c.json(
          {
            error: "We couldn't create any recommendations for you. Please make sure your bookshelf is readable.",
            success: false,
          },
          422
        );
      }

      return c.json({
        recommendations: recommendation.recommendations,
        hasEmail: !!recommendation.email,
        isRecurringMonthly: !!recommendation.frequency,
        success: true
      }, 200);
    }
  );
}
