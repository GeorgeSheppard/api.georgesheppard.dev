import { recommendations, requests } from '@core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '@core/database/client.js';
import type { Recommendation } from '@core/types/recommendation.js';

export interface RecommendationWithRequest {
  recommendations: Recommendation[] | null;
  processedUtc: Date | null;
  email: string | null;
  frequency: string | null;
}

/**
 * Find a recommendation by ID with its associated request data.
 *
 * @param db - Drizzle database instance
 * @param id - Recommendation UUID
 * @returns Recommendation with request data, or null if not found
 */
export async function findRecommendationWithRequest(
  db: DatabaseClient['db'],
  id: string
): Promise<RecommendationWithRequest | null> {
  const result = await db
    .select({
      recommendations: recommendations.recommendations,
      processedUtc: recommendations.processedUtc,
      email: requests.email,
      frequency: requests.frequency,
    })
    .from(recommendations)
    .innerJoin(requests, eq(recommendations.requestId, requests.id))
    .where(eq(recommendations.id, id))
    .limit(1);

  return result[0] ?? null;
}
