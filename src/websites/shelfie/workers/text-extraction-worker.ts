import { requests, images } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { textExtractorClient } from '@core/utils/text-extractor.js';
import { TextExtractionJob, QueueClient } from '@core/queue/client.js';
import { DatabaseClient } from '@core/database/client.js';

export async function processTextExtractionJob(
  job: TextExtractionJob,
  databaseClient: DatabaseClient,
  queueClient: QueueClient
) {
  const { userId, recommendationId } = job;

  console.log(`Processing text extraction for user ${userId}`);

  const { db } = databaseClient;

  // Fetch user
  const [user] = await db.select().from(requests).where(eq(requests.id, userId));

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Fetch all images for this user
  const userImages = await db.select().from(images).where(eq(images.requestId, userId));

  if (userImages.length === 0) {
    throw new Error(`No images found for user: ${userId}`);
  }

  // Extract text from all images
  const allBooks: string[] = [];
  for (const image of userImages) {
    console.log(`Extracting text from image ${image.id}`);

    const result = await textExtractorClient.extractText(image.image, image.contentType);
    allBooks.push(...result.books);
  }

  // Remove duplicates
  const uniqueBooks = Array.from(new Set(allBooks));

  // Update user with processed books
  await db
    .update(requests)
    .set({
      booksProcessed: { books: uniqueBooks },
      booksProcessedUtc: new Date(),
    })
    .where(eq(requests.id, userId));

  console.log(`Extracted ${uniqueBooks.length} unique books`);

  // Queue recommendation generation
  queueClient.channel.sendToQueue(
    queueClient.recommendationQueue,
    Buffer.from(JSON.stringify({ userId, recommendationId })),
    { persistent: true }
  );

  return { booksExtracted: uniqueBooks.length };
}
