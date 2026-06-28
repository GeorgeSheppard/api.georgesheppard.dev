import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { findDueUsers, createRecurringRecommendation } from '../queries/recommendations.js';
import { authMiddleware } from '@core/middleware/auth.js';
import { ROUTES } from './paths.js';
import { logger } from '@core/telemetry/logger.js';
import { config } from '@config/index.js';

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

export interface QueueCronResult {
  successCount: number;
  totalUsers: number;
  queueFailures: number;
}

export async function queueDueRecommendations(c: Context): Promise<QueueCronResult> {
  const { db } = c.get('databaseClient');
  const queueClient = c.get('queueClient');

  const dueUsers = await findDueUsers(db);

  let successCount = 0;
  let queueFailures = 0;

  for (const user of dueUsers) {
    try {
      const recommendation = await createRecurringRecommendation(db, user.id);

      try {
        queueClient.channel.sendToQueue(
          queueClient.recommendationQueue,
          Buffer.from(JSON.stringify({ userId: user.id, recommendationId: recommendation.id })),
          { persistent: true }
        );
        successCount++;
      } catch (queueError) {
        logger.error(`Failed to queue recommendation for user ${user.id}:`, queueError);
        queueFailures++;
      }
    } catch (error) {
      logger.error(`Failed to process user ${user.id}:`, error);
    }
  }

  logger.info(
    `Queued recommendations for ${successCount}/${dueUsers.length} users (${queueFailures} queue failures)`
  );

  await pingHealthcheck();

  return { successCount, totalUsers: dueUsers.length, queueFailures };
}

async function pingHealthcheck(): Promise<void> {
  if (!config.RECOMMENDATIONS_CRON_HEALTHCHECK_URL) {
    return;
  }

  try {
    await fetch(config.RECOMMENDATIONS_CRON_HEALTHCHECK_URL);
  } catch (error) {
    logger.error('Failed to ping recommendations cron healthcheck:', error);
  }
}

export function registerQueueCronRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    await queueDueRecommendations(c);
    return c.body(null, 204);
  });
}
