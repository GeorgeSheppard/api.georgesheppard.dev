#!/usr/bin/env tsx

/**
 * One-off backfill: re-encodes every already-stored bookcase image through the same
 * resize/compress step new uploads now go through (see multipart.ts), so existing accounts
 * aren't stuck with full-resolution phone photos (often several MB each) from before that
 * fix shipped. Safe to re-run — already-small images are skipped.
 *
 * Usage: pnpm tsx scripts/backfill-resize-images.ts
 */

import { config } from '@config/index.js';
import { createDatabaseClient } from '@core/database/client.js';
import { resizeAndCompressImage } from '@core/utils/image-resizer.js';
import { images } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';

// Below this, re-encoding isn't worth the risk of a (tiny) quality loss.
const MIN_SIZE_TO_RESIZE_BYTES = 500 * 1024;

async function main() {
  const { db, close } = await createDatabaseClient(config.DATABASE_URL);

  try {
    const rows = await db.select({ id: images.id, image: images.image }).from(images);

    let resized = 0;
    let skipped = 0;
    let failed = 0;
    let bytesBefore = 0;
    let bytesAfter = 0;

    for (const row of rows) {
      if (row.image.length < MIN_SIZE_TO_RESIZE_BYTES) {
        skipped++;
        continue;
      }

      try {
        const { buffer, contentType } = await resizeAndCompressImage(row.image);
        await db.update(images).set({ image: buffer, contentType }).where(eq(images.id, row.id));

        bytesBefore += row.image.length;
        bytesAfter += buffer.length;
        resized++;
        console.log(`Resized image ${row.id}: ${row.image.length} -> ${buffer.length} bytes`);
      } catch (error) {
        failed++;
        console.error(`Failed to resize image ${row.id}:`, error);
      }
    }

    console.log(
      `\nDone. Resized ${resized}, skipped ${skipped} (already small), failed ${failed}.`
    );
    if (resized > 0) {
      console.log(`Total bytes: ${bytesBefore} -> ${bytesAfter}`);
    }
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
