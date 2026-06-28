import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { eq, isNotNull } from 'drizzle-orm';
import { requests, images } from '@core/database/schema/index.js';
import { updateBooksProcessed } from '../queries/recommendations.js';
import { extractBooksFromImages } from '@core/utils/openai-book-extractor.js';
import { authMiddleware } from '@core/middleware/auth.js';
import { ROUTES } from './paths.js';
import { logger } from '@core/telemetry/logger.js';

const route = createRoute({
  method: 'get',
  path: ROUTES.REEXTRACT_RECURRING_BOOKS,
  tags: ['cron'],
  security: [{ apiKey: [] }],
  middleware: authMiddleware,
  request: {
    headers: z.object({
      'x-api-key': z.string().describe('API key for authentication'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            totalUsers: z.number(),
            processedUsers: z.number(),
            skippedUsers: z.number(),
            failures: z.number(),
          }),
        },
      },
      description: 'Books re-extracted for recurring users',
    },
    401: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Unauthorized',
    },
  },
});

export interface ReextractRecurringBooksResult {
  totalUsers: number;
  processedUsers: number;
  skippedUsers: number;
  failures: number;
}

export async function reextractRecurringBooks(c: Context): Promise<ReextractRecurringBooksResult> {
  const { db } = c.get('databaseClient');
  const openaiClient = c.get('openaiClient');

  const recurringUsers = await db
    .select({ id: requests.id, booksProcessed: requests.booksProcessed })
    .from(requests)
    .where(isNotNull(requests.frequency));

  let processedUsers = 0;
  let skippedUsers = 0;
  let failures = 0;

  for (const user of recurringUsers) {
    const userImages = await db.select().from(images).where(eq(images.requestId, user.id));

    if (userImages.length === 0) {
      skippedUsers++;
      continue;
    }

    try {
      const extractedBooks = await extractBooksFromImages(
        userImages.map((image) => ({ buffer: image.image, contentType: image.contentType })),
        openaiClient.getClient()
      );

      await updateBooksProcessed(db, user.id, extractedBooks);
      logger.info(
        `Re-extracted books for ${user.id}`,
        `Before: ${JSON.stringify(user.booksProcessed)}`,
        `After: ${JSON.stringify(extractedBooks)}`
      );
      processedUsers++;
    } catch (error) {
      logger.error(`Failed to re-extract books for ${user.id}:`, error);
      failures++;
    }
  }

  return { totalUsers: recurringUsers.length, processedUsers, skippedUsers, failures };
}

export function registerReextractRecurringBooksRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const result = await reextractRecurringBooks(c);
    return c.json(result, 200);
  });
}
