import { setImageExtractedBooks } from '../queries/recommendations.js';
import { extractBooksFromImages } from '@core/utils/openai-book-extractor.js';
import type { UploadedFile } from '@core/utils/multipart.js';
import type { OpenAIClientWrapper } from '@core/utils/openai-client.js';
import type { DatabaseClient } from '@core/database/client.js';

/**
 * Extract books per image (rather than one combined call across all images) so each
 * image's books can be stored alongside it — this is what lets deleting a photo later
 * cleanly drop just its books from the amalgamated list, and lets a failed extraction
 * on one image be retried without redoing the others.
 */
export async function extractAndStoreBooksPerImage(
  db: DatabaseClient['db'],
  files: UploadedFile[],
  imageIds: number[],
  openaiClient: OpenAIClientWrapper
): Promise<void> {
  await Promise.all(
    files.map(async (file, index) => {
      const books = await extractBooksFromImages(
        [{ buffer: file.data, contentType: file.mimetype }],
        openaiClient.getClient()
      );
      await setImageExtractedBooks(db, imageIds[index], books);
    })
  );
}
