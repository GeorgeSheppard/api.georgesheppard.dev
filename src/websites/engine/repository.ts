import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { DatabaseClient } from '@core/database/client.js';
import { engineJobs, engineServers } from '@core/database/schema/index.js';
import type { EngineJobStatus, EngineServerStatus } from './types.js';

export type EngineJobRow = typeof engineJobs.$inferSelect;

export type CreateJobOutcome =
  | { ok: true; job: EngineJobRow; baseKey?: string }
  | { ok: false; reason: 'full' | 'busy' | 'unknown_project' };

export async function createJob(
  { db }: DatabaseClient,
  maxQueued: number,
  projectId?: string
): Promise<CreateJobOutcome> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(engineJobs)
    .where(inArray(engineJobs.status, ['queued', 'running']));
  if (count >= maxQueued) return { ok: false, reason: 'full' };

  if (!projectId) {
    const id = randomUUID();
    const [job] = await db.insert(engineJobs).values({ id, projectId: id, version: 1 }).returning();
    return { ok: true, job };
  }

  const history = await db.select().from(engineJobs).where(eq(engineJobs.projectId, projectId));
  if (history.some((j) => j.status === 'queued' || j.status === 'running')) {
    return { ok: false, reason: 'busy' };
  }
  const latest = history
    .filter((j) => j.status === 'succeeded' && j.s3Prefix)
    .sort((x, y) => y.version - x.version)[0];
  if (!latest?.s3Prefix) return { ok: false, reason: 'unknown_project' };
  const version = Math.max(...history.map((j) => j.version)) + 1;
  const [job] = await db.insert(engineJobs).values({ projectId, version }).returning();
  return { ok: true, job, baseKey: latest.s3Prefix };
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

export async function countActiveServers(
  { db }: DatabaseClient,
  excludeProjectId?: string
): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(engineServers)
    .innerJoin(engineJobs, eq(engineJobs.id, engineServers.jobId))
    .where(
      and(
        inArray(engineServers.status, ACTIVE_SERVER_STATUSES),
        excludeProjectId ? ne(engineJobs.projectId, excludeProjectId) : undefined
      )
    );
  return count;
}

export async function getActiveServersForProject(
  { db }: DatabaseClient,
  projectId: string
): Promise<EngineServerRow[]> {
  const rows = await db
    .select({ server: engineServers })
    .from(engineServers)
    .innerJoin(engineJobs, eq(engineJobs.id, engineServers.jobId))
    .where(
      and(
        eq(engineJobs.projectId, projectId),
        inArray(engineServers.status, ACTIVE_SERVER_STATUSES)
      )
    );
  return rows.map((r) => r.server);
}

export async function listServersWithProject({ db }: DatabaseClient) {
  const rows = await db
    .select({ server: engineServers, projectId: engineJobs.projectId, version: engineJobs.version })
    .from(engineServers)
    .innerJoin(engineJobs, eq(engineJobs.id, engineServers.jobId))
    .orderBy(desc(engineServers.createdUtc))
    .limit(100);
  return rows.map((r) => ({ ...r.server, projectId: r.projectId, version: r.version }));
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
