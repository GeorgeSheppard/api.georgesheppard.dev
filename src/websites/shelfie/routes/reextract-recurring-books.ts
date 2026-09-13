import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import {
  findUnprocessedImagesForRecurringUsers,
  setImageExtractedBooks,
} from '../queries/recommendations.js';
import { extractBooksFromImages } from '@core/utils/openai-book-extractor.js';
import { convertHeicToJpeg, isHeicFile } from '@core/utils/heic-converter.js';
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
            totalImages: z.number(),
            processedImages: z.number(),
            failures: z.number(),
          }),
        },
      },
      description: "Books extracted for recurring users' unprocessed images",
    },
    401: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Unauthorized',
    },
  },
});

export interface ReextractRecurringBooksResult {
  totalImages: number;
  processedImages: number;
  failures: number;
}

/**
 * Catch-up job: extracts and stores books for any recurring user's image that doesn't
 * have extractedBooks yet — images added since the last run, or ones whose extraction
 * previously failed. Images that already have extractedBooks are never touched again.
 */
export async function reextractRecurringBooks(c: Context): Promise<ReextractRecurringBooksResult> {
  const { db } = c.get('databaseClient');
  const openaiClient = c.get('openaiClient');

  const unprocessedImages = await findUnprocessedImagesForRecurringUsers(db);

  let processedImages = 0;
  let failures = 0;

  for (const image of unprocessedImages) {
    try {
      const converted = isHeicFile(image.contentType, '')
        ? { buffer: await convertHeicToJpeg(image.image), contentType: 'image/jpeg' }
        : { buffer: image.image, contentType: image.contentType };

      const books = await extractBooksFromImages([converted], openaiClient.getClient());
      await setImageExtractedBooks(db, image.id, books);
      processedImages++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        `Failed to extract books for image ${image.id} (request ${image.requestId}): ${message}`,
        {
          error,
        }
      );
      failures++;
    }
  }

  return { totalImages: unprocessedImages.length, processedImages, failures };
}

export function registerReextractRecurringBooksRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const result = await reextractRecurringBooks(c);
    return c.json(result, 200);
  });
}
