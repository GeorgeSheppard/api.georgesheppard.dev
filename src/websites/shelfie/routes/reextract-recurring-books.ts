import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { eq, isNotNull } from 'drizzle-orm';
import { requests, images } from '@core/database/schema/index.js';
import { updateBooksProcessed } from '../queries/recommendations.js';
import { extractBooksFromImages } from '@core/utils/openai-book-extractor.js';
import { convertHeicToJpeg, isHeicFile } from '@core/utils/heic-converter.js';
import { authMiddleware } from '@core/middleware/auth.js';
import { ROUTES } from './paths.js';
import { logger } from '@core/telemetry/logger.js';
import type { BooksProcessed } from '@core/types/recommendation.js';

function needsReextraction(booksProcessed: BooksProcessed | null): boolean {
  if (!booksProcessed) return true;
  const first = booksProcessed.books[0];
  // Old format stored books as plain strings rather than {title, author} objects
  return typeof first === 'string';
}

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
    if (!needsReextraction(user.booksProcessed)) {
      logger.info(`Skipping ${user.id}: already in current format`);
      skippedUsers++;
      continue;
    }

    const userImages = await db.select().from(images).where(eq(images.requestId, user.id));

    if (userImages.length === 0) {
      logger.info(`Skipping ${user.id}: no stored images`);
      skippedUsers++;
      continue;
    }

    try {
      const convertedImages = await Promise.all(
        userImages.map(async (image) => {
          if (isHeicFile(image.contentType, '')) {
            logger.info(`Converting HEIC image for user ${user.id}`);
            return { buffer: await convertHeicToJpeg(image.image), contentType: 'image/jpeg' };
          }
          return { buffer: image.image, contentType: image.contentType };
        })
      );

      const extractedBooks = await extractBooksFromImages(
        convertedImages,
        openaiClient.getClient()
      );

      await updateBooksProcessed(db, user.id, extractedBooks);
      logger.info(
        `Re-extracted books for ${user.id} — ` +
          `before: ${JSON.stringify(user.booksProcessed)}, ` +
          `after: ${JSON.stringify(extractedBooks)}`
      );
      processedUsers++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to re-extract books for ${user.id}: ${message}`, { error });
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
