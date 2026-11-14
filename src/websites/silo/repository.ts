import { desc, eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseClient } from '@core/database/client.js';
import { siloJobs } from '@core/database/schema/index.js';
import type { SiloJobResult, SiloJobStatus } from './types.js';

export type SiloJobRow = typeof siloJobs.$inferSelect;

export async function createJob(
  { db }: DatabaseClient,
  prompt: string,
  maxQueued: number
): Promise<SiloJobRow | undefined> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(siloJobs)
    .where(inArray(siloJobs.status, ['queued', 'running']));
  if (count >= maxQueued) return undefined;
  const [row] = await db.insert(siloJobs).values({ prompt }).returning();
  return row;
}

export async function getJob({ db }: DatabaseClient, id: string): Promise<SiloJobRow | undefined> {
  const [row] = await db.select().from(siloJobs).where(eq(siloJobs.id, id));
  return row;
}

export async function listJobs({ db }: DatabaseClient, limit = 50): Promise<SiloJobRow[]> {
  return db.select().from(siloJobs).orderBy(desc(siloJobs.createdUtc)).limit(limit);
}

export async function updateJob(
  { db }: DatabaseClient,
  id: string,
  patch: { status?: SiloJobStatus; logs?: string[]; result?: SiloJobResult; error?: string }
): Promise<void> {
  await db
    .update(siloJobs)
    .set({ ...patch, updatedUtc: new Date() })
    .where(eq(siloJobs.id, id));
}
