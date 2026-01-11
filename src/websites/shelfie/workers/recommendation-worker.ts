import { requests, recommendations } from '@core/database/schema/index.js';
import { eq, desc, isNotNull, and } from 'drizzle-orm';
import { Recommender } from '@core/utils/openai-recommender.js';
import { EmailClient } from '@core/utils/mailgun.js';
import { encryption } from '@core/utils/encryption.js';
import { RecommendationJob } from '@core/queue/client.js';
import { DatabaseClient } from '@core/database/client.js';
import { Location } from '@core/types/index.js';

export async function processRecommendationJob(
  job: RecommendationJob,
  databaseClient: DatabaseClient,
  emailClient: EmailClient,
  recommender: Recommender
) {
  const { userId, recommendationId } = job;

  console.log(`Generating recommendations for user ${userId}`);

  const { db } = databaseClient;

  // Fetch user with books processed
  const [user] = await db.select().from(requests).where(eq(requests.id, userId));

  if (!user || !user.booksProcessed) {
    throw new Error(`User or books not found: ${userId}`);
  }

  // Fetch previous recommendations (last 6)
  const previousRecs = await db
    .select()
    .from(recommendations)
    .where(and(eq(recommendations.requestId, userId), isNotNull(recommendations.processedUtc)))
    .orderBy(desc(recommendations.processedUtc))
    .limit(6);

  const previousBooks = previousRecs.flatMap((r) => r.recommendations || []);

  console.log(`Found ${previousBooks.length} previous recommendations`);

  // Generate new recommendations
  const location = (user.location as Location) || Location.Us;
  const newRecommendations = await recommender.getRecommendations(
    user.booksProcessed.books,
    location,
    previousBooks
  );

  // Update recommendation record
  await db
    .update(recommendations)
    .set({
      recommendations: newRecommendations,
      processedUtc: new Date(),
    })
    .where(eq(recommendations.id, recommendationId));

  console.log(`Generated ${newRecommendations.length} recommendations`);

  // Send email if user has email
  if (user.email) {
    try {
      const plaintextEmail = encryption.decrypt(user.email);

      await emailClient.sendRecommendationsEmail({
        from: 'Shelfie <postmaster@mailgun.shelfie.georgesheppard.dev>',
        to: [plaintextEmail],
        subject: 'Your Shelfie recommendations are here!',
        template: 'recommendations',
        variables: {
          recommendationsurl: `https://shelfie.georgesheppard.dev/recommendations/${recommendationId}`,
          unsubscribeUrl: `https://shelfie.georgesheppard.dev/unsubscribe/${userId}`,
          unsubscribeText: user.frequency ? 'Unsubscribe' : '',
        },
      });

      console.log('Email sent successfully');

      // Clear email if one-time subscription
      if (!user.frequency) {
        await db.update(requests).set({ email: null }).where(eq(requests.id, userId));
      }
    } catch (error) {
      console.error(`Failed to send email: ${error}`);
      // Don't fail the job if email fails
    }
  }

  return { recommendationsGenerated: newRecommendations.length };
}
