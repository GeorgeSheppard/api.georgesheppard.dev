import { recommendations, requests, images } from '@core/database/schema/index.js';
import { eq, lt, isNotNull, and } from 'drizzle-orm';
import type { DatabaseClient } from '@core/database/client.js';
import type { Recommendation, BooksProcessed } from '@core/types/recommendation.js';
import type { UploadedFile } from '@core/utils/multipart.js';

export interface RecommendationWithRequest {
  recommendations: Recommendation[] | null;
  processedUtc: Date | null;
  email: string | null;
  frequency: string | null;
}

/**
 * Find a recommendation by ID with its associated request data.
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

export interface RecommendationRow {
  id: string;
  requestId: string;
  recommendations: Recommendation[] | null;
  processedUtc: Date | null;
}

/**
 * Find a recommendation by ID (without joining request).
 */
export async function findRecommendationById(
  db: DatabaseClient['db'],
  id: string
): Promise<RecommendationRow | null> {
  const result = await db
    .select({
      id: recommendations.id,
      requestId: recommendations.requestId,
      recommendations: recommendations.recommendations,
      processedUtc: recommendations.processedUtc,
    })
    .from(recommendations)
    .where(eq(recommendations.id, id))
    .limit(1);

  return result[0] ?? null;
}

export interface RequestRow {
  id: string;
  email: string | null;
}

/**
 * Find a request by ID (email fields only).
 */
export async function findRequestById(
  db: DatabaseClient['db'],
  id: string
): Promise<RequestRow | null> {
  const result = await db
    .select({
      id: requests.id,
      email: requests.email,
    })
    .from(requests)
    .where(eq(requests.id, id))
    .limit(1);

  return result[0] ?? null;
}

export interface UpdateRequestEmailFields {
  email: string | null;
  frequency: string | null;
  nextRecommendationUtc: Date | null;
}

/**
 * Update email-related fields on a request.
 */
export async function updateRequestEmailFields(
  db: DatabaseClient['db'],
  requestId: string,
  fields: UpdateRequestEmailFields
): Promise<void> {
  await db.update(requests).set(fields).where(eq(requests.id, requestId));
}

/**
 * Clear email, frequency, and nextRecommendationUtc on a request.
 */
export async function clearRequestEmailFields(
  db: DatabaseClient['db'],
  requestId: string
): Promise<void> {
  await db
    .update(requests)
    .set({
      email: null,
      frequency: null,
      nextRecommendationUtc: null,
    })
    .where(eq(requests.id, requestId));
}

export interface BookcaseRequestResult {
  newRequest: { id: string };
  recommendation: { id: string };
}

/**
 * Create a new bookcase request with images and recommendation in a transaction.
 */
export async function createBookcaseRequest(
  db: DatabaseClient['db'],
  location: string,
  files: UploadedFile[]
): Promise<BookcaseRequestResult> {
  return db.transaction(async (tx) => {
    const [newRequest] = await tx
      .insert(requests)
      .values({
        createdUtc: new Date(),
        location,
      })
      .returning();

    const [recommendationResults] = await Promise.all([
      tx
        .insert(recommendations)
        .values({
          requestId: newRequest.id,
        })
        .returning(),
      tx.insert(images).values(
        files.map((file) => ({
          requestId: newRequest.id,
          image: file.data,
          contentType: file.mimetype,
        }))
      ),
    ]);

    const [recommendation] = recommendationResults;

    return { newRequest, recommendation };
  });
}

export interface DueUser {
  id: string;
  location: string | null;
  email: string | null;
  booksProcessed: BooksProcessed | null;
}

/**
 * Find all users with due recurring recommendations.
 */
export async function findDueUsers(db: DatabaseClient['db']): Promise<DueUser[]> {
  return db
    .select({
      id: requests.id,
      location: requests.location,
      email: requests.email,
      booksProcessed: requests.booksProcessed,
    })
    .from(requests)
    .where(and(lt(requests.nextRecommendationUtc, new Date()), isNotNull(requests.frequency)));
}

export interface RecurringRecommendationResult {
  id: string;
}

/**
 * Create a recurring recommendation for a user: insert recommendation + update next date.
 */
export async function createRecurringRecommendation(
  db: DatabaseClient['db'],
  userId: string
): Promise<RecurringRecommendationResult> {
  return db.transaction(async (tx) => {
    const nextDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [insertResult] = await Promise.all([
      tx
        .insert(recommendations)
        .values({
          requestId: userId,
        })
        .returning(),
      tx
        .update(requests)
        .set({
          nextRecommendationUtc: nextDate,
        })
        .where(eq(requests.id, userId)),
    ]);

    return insertResult[0];
  });
}
