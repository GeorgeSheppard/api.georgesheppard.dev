import { eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseClient } from '@core/database/client.js';
import { engineJobs } from '@core/database/schema/index.js';
import type { EngineJobStatus } from './types.js';

export type EngineJobRow = typeof engineJobs.$inferSelect;

export async function createJob(
  { db }: DatabaseClient,
  maxQueued: number
): Promise<EngineJobRow | undefined> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(engineJobs)
    .where(inArray(engineJobs.status, ['queued', 'running']));
  if (count >= maxQueued) return undefined;
  const [row] = await db.insert(engineJobs).values({}).returning();
  return row;
}

export async function getJob(
  { db }: DatabaseClient,
  id: string
): Promise<EngineJobRow | undefined> {
  const [row] = await db.select().from(engineJobs).where(eq(engineJobs.id, id));
  return row;
}

export async function updateJob(
  { db }: DatabaseClient,
  id: string,
  patch: { status?: EngineJobStatus; s3Prefix?: string; error?: string }
): Promise<void> {
  await db.update(engineJobs).set(patch).where(eq(engineJobs.id, id));
}
