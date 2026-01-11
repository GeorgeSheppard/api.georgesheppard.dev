import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { recommendations, requests } from '@core/database/schema/index.js';
import { eq, lt, isNotNull, and } from 'drizzle-orm';
import { authMiddleware } from '@core/middleware/auth.js';
import { ROUTES } from './paths.js';

const route = createRoute({
  method: 'get',
  path: ROUTES.QUEUE_DUE_RECOMMENDATIONS,
  tags: ['cron'],
  security: [{ apiKey: [] }],
  middleware: authMiddleware,
  request: {
    headers: z.object({
      'x-api-key': z.string().describe('API key for authentication'),
    }),
  },
  responses: {
    204: {
      description: 'Recommendations queued successfully',
    },
    401: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Unauthorized',
    },
  },
});

export function registerQueueCronRoute(app: OpenAPIHono) {
  app.openapi(
    route,
    async (c) => {
      const { db } = c.get('databaseClient');
      const queueClient = c.get('queueClient');

      // Read operation: Find all users with due recommendations
      const dueUsers = await db
        .select({
          id: requests.id,
          location: requests.location,
          email: requests.email,
          booksProcessed: requests.booksProcessed,
        })
        .from(requests)
        .where(
          and(
            lt(requests.nextRecommendationUtc, new Date()),
            isNotNull(requests.frequency)
          )
        );

      let successCount = 0;
      let queueFailures = 0;

      // Process each user in a separate transaction
      for (const user of dueUsers) {
        try {
          // Transaction: Create recommendation and update nextRecommendationUtc
          const recommendation = await db.transaction(async (tx) => {
            // Calculate next recommendation date (30 days from now)
            const nextDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            // Parallelize the two mutations for better performance
            const [insertResult] = await Promise.all([
              tx
                .insert(recommendations)
                .values({
                  requestId: user.id,
                })
                .returning(),
              tx
                .update(requests)
                .set({
                  nextRecommendationUtc: nextDate,
                })
                .where(eq(requests.id, user.id)),
            ]);

            return insertResult[0];
          });

          // Queue operation: Send to RabbitMQ after transaction commits
          try {
            queueClient.channel.sendToQueue(
              queueClient.recommendationQueue,
              Buffer.from(JSON.stringify({ userId: user.id, recommendationId: recommendation.id })),
              { persistent: true }
            );
            successCount++;
          } catch (queueError) {
            // Log queue failure but don't fail the entire operation
            console.error(`Failed to queue recommendation for user ${user.id}:`, queueError);
            queueFailures++;
          }
        } catch (error) {
          // Log database transaction failure and continue with next user
          console.error(`Failed to process user ${user.id}:`, error);
        }
      }

      console.log(`Queued recommendations for ${successCount}/${dueUsers.length} users (${queueFailures} queue failures)`);

      return c.body(null, 204);
    }
  );
}
