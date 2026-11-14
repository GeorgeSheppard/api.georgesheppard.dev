import { desc, eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseClient } from '@core/database/client.js';
import { engineJobs, engineServers } from '@core/database/schema/index.js';
import type { EngineJobStatus, EngineServerStatus } from './types.js';

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

export type EngineServerRow = typeof engineServers.$inferSelect;

const ACTIVE_SERVER_STATUSES: EngineServerStatus[] = ['provisioning', 'running'];

export async function listServers(
  { db }: DatabaseClient,
  options: { activeOnly?: boolean } = {}
): Promise<EngineServerRow[]> {
  const query = db.select().from(engineServers);
  return (
    options.activeOnly ? query.where(inArray(engineServers.status, ACTIVE_SERVER_STATUSES)) : query
  )
    .orderBy(desc(engineServers.createdUtc))
    .limit(100);
}

export async function getServerByJob(
  { db }: DatabaseClient,
  jobId: string
): Promise<EngineServerRow | undefined> {
  const [row] = await db.select().from(engineServers).where(eq(engineServers.jobId, jobId));
  return row;
}

export async function getServer(
  { db }: DatabaseClient,
  id: string
): Promise<EngineServerRow | undefined> {
  const [row] = await db.select().from(engineServers).where(eq(engineServers.id, id));
  return row;
}

export async function countActiveServers({ db }: DatabaseClient): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(engineServers)
    .where(inArray(engineServers.status, ACTIVE_SERVER_STATUSES));
  return count;
}

export async function insertServer(
  { db }: DatabaseClient,
  values: { jobId: string }
): Promise<EngineServerRow> {
  const [row] = await db.insert(engineServers).values(values).returning();
  return row;
}

export async function updateServer(
  { db }: DatabaseClient,
  id: string,
  patch: Partial<Omit<EngineServerRow, 'id' | 'jobId' | 'createdUtc'>>
): Promise<void> {
  await db.update(engineServers).set(patch).where(eq(engineServers.id, id));
}
