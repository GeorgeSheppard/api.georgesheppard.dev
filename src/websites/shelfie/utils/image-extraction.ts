import {
  findUnprocessedImagesForRequest,
  setImageExtractedBooks,
} from '../queries/recommendations.js';
import { extractBooksFromImages } from '@core/utils/openai-book-extractor.js';
import { convertHeicToJpeg, isHeicFile } from '@core/utils/heic-converter.js';
import type { OpenAIClientWrapper } from '@core/utils/openai-client.js';
import type { DatabaseClient } from '@core/database/client.js';
import { logger } from '@core/telemetry/logger.js';

/**
 * Extract and store books for any of a request's images that don't have extractedBooks yet.
 * Runs in the recommendation worker rather than the upload HTTP handler, so a slow OpenAI
 * vision call never blocks the upload response — the worker picks up unprocessed images
 * right before generating recommendations. A failure on one image is logged and skipped
 * rather than failing the whole job, so it can be picked up again by a later run.
 */
export async function extractAndStoreBooksForRequest(
  db: DatabaseClient['db'],
  requestId: string,
  openaiClient: OpenAIClientWrapper
): Promise<void> {
  const unprocessedImages = await findUnprocessedImagesForRequest(db, requestId);

  await Promise.all(
    unprocessedImages.map(async (image) => {
      try {
        const converted = isHeicFile(image.contentType, '')
          ? { buffer: await convertHeicToJpeg(image.image), contentType: 'image/jpeg' }
          : { buffer: image.image, contentType: image.contentType };

        const books = await extractBooksFromImages([converted], openaiClient.getClient());
        await setImageExtractedBooks(db, image.id, books);
      } catch (error) {
        logger.error(
          `Failed to extract books for image ${image.id} (request ${requestId}):`,
          error
        );
      }
    })
  );
}
