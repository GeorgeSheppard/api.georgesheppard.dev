import { requests, recommendations } from '@core/database/schema/index.js';
import { eq, desc, isNotNull, and } from 'drizzle-orm';
import { Recommender } from '@core/utils/openai-recommender.js';
import { EmailClient } from '@core/utils/mailgun.js';
import { encryption } from '@core/utils/encryption.js';
import { RecommendationJob } from '@core/queue/client.js';
import { DatabaseClient } from '@core/database/client.js';
import { Location } from '@core/types/location.js';
import { logger } from '@core/telemetry/logger.js';
import { OpenAIClientWrapper } from '@core/utils/openai-client.js';
import { getExtractedBooksForRequest } from '../queries/recommendations.js';
import { extractAndStoreBooksForRequest } from '../utils/image-extraction.js';

export async function processRecommendationJob(
  job: RecommendationJob,
  databaseClient: DatabaseClient,
  emailClient: EmailClient,
  recommender: Recommender,
  openaiClient: OpenAIClientWrapper
) {
  const { userId, recommendationId } = job;

  logger.info(`Generating recommendations for user ${userId}`);

  const { db } = databaseClient;

  const [user] = await db.select().from(requests).where(eq(requests.id, userId));

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Uploads respond immediately without waiting on OpenAI vision, so any images added since
  // the last recommendation may still need extracting before we can amalgamate the book list.
  await extractAndStoreBooksForRequest(db, userId, openaiClient);

  const books = await getExtractedBooksForRequest(db, userId);
  if (books.length === 0) {
    throw new Error(`No processed books found for user: ${userId}`);
  }

  // Fetch previous recommendations (last 6)
  const previousRecs = await db
    .select()
    .from(recommendations)
    .where(and(eq(recommendations.requestId, userId), isNotNull(recommendations.processedUtc)))
    .orderBy(desc(recommendations.processedUtc))
    .limit(6);

  const previousBooks = previousRecs.flatMap((r) => r.recommendations || []);

  logger.info(`Found ${previousBooks.length} previous recommendations`);

  // Generate new recommendations
  const location = (user.location as Location) || Location.Us;
  const newRecommendations = await recommender.getRecommendations(
    books,
    location,
    previousBooks,
    user.customPreferences
  );

  // Update recommendation record
  await db
    .update(recommendations)
    .set({
      recommendations: newRecommendations,
      processedUtc: new Date(),
    })
    .where(eq(recommendations.id, recommendationId));

  logger.info(`Generated ${newRecommendations.length} recommendations`);

  // Send email if user has email. The address is kept regardless of whether they opted into
  // monthly recurring emails — a request can get several ad-hoc recommendations (e.g. via the
  // profile page's "add photos"/"tailor recommendations" actions), and someone who gave their
  // email for the first one clearly wants to hear about the rest too, not re-enter it each time.
  if (user.email) {
    try {
      const plaintextEmail = encryption.decrypt(user.email);

      await emailClient.sendRecommendationsEmail({
        from: 'Shelfie <postmaster@mail.georgesheppard.dev>',
        to: [plaintextEmail],
        subject: 'Your Shelfie recommendations are here!',
        template: 'shelfie recommendations',
        variables: {
          recommendationsurl: `https://shelfie.georgesheppard.dev/recommendations/${recommendationId}`,
          unsubscribeUrl: `https://shelfie.georgesheppard.dev/unsubscribe/${userId}`,
          unsubscribeText: 'Unsubscribe',
        },
      });

      logger.info('Email sent successfully');
    } catch (error) {
      logger.error(`Failed to send email: ${error}`);
      // Don't fail the job if email fails
    }
  }

  return { recommendationsGenerated: newRecommendations.length };
}
