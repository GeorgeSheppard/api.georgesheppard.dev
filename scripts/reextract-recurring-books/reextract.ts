#!/usr/bin/env tsx

/**
 * Re-extracts books from stored bookcase images using the latest extraction
 * algorithm, for users who have opted into recurring recommendations.
 *
 * Usage:
 *   pnpm tsx scripts/reextract-recurring-books/reextract.ts
 */

import { eq, isNotNull } from 'drizzle-orm';
import { config } from '@config/index.js';
import { createDatabaseClient } from '@core/database/client.js';
import { requests, images } from '@core/database/schema/index.js';
import { extractBooksFromImages } from '@core/utils/openai-book-extractor.js';
import { OpenAIClientWrapper } from '@core/utils/openai-client.js';
import { updateBooksProcessed } from '@websites/shelfie/queries/recommendations.js';

async function reextractBooksForRecurringUsers(): Promise<void> {
  const { db, close } = await createDatabaseClient(config.DATABASE_URL);
  const openaiClient = new OpenAIClientWrapper();

  try {
    const recurringUsers = await db
      .select({ id: requests.id, booksProcessed: requests.booksProcessed })
      .from(requests)
      .where(isNotNull(requests.frequency));

    console.log(`Found ${recurringUsers.length} recurring users\n`);

    for (const user of recurringUsers) {
      const userImages = await db.select().from(images).where(eq(images.requestId, user.id));

      if (userImages.length === 0) {
        console.log(`Skipping ${user.id}: no stored images`);
        continue;
      }

      try {
        const extractedBooks = await extractBooksFromImages(
          userImages.map((image) => ({ buffer: image.image, contentType: image.contentType })),
          openaiClient.getClient()
        );

        await updateBooksProcessed(db, user.id, extractedBooks);
        console.log(
          `Re-extracted books for ${user.id}\n` +
            `  Before: ${JSON.stringify(user.booksProcessed)}\n` +
            `  After:  ${JSON.stringify(extractedBooks)}`
        );
      } catch (error) {
        console.error(`Failed to re-extract books for ${user.id}:`, error);
      }
    }
  } finally {
    await close();
  }
}

reextractBooksForRecurringUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
