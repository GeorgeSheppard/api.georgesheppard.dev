import type { S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';
import type { DatabaseClient } from '@core/database/client.js';
import { readJobMeta } from '../../generation/job-meta.js';
import { getJob, getServerByJob } from '../../repository.js';

export const GetJobParamsSchema = z.object({ id: z.string().uuid().describe('Job ID') });

export const GetJobResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().describe('Pass back as projectId to keep iterating'),
  version: z.number().int(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  error: z.string().nullable(),
  result: z
    .object({
      pluginId: z.string(),
      name: z.string(),
      summary: z.string(),
      mcVersion: z.string(),
      loader: z.string(),
      s3Prefix: z.string(),
    })
    .nullable(),
  server: z
    .object({
      id: z.string().uuid(),
      status: z.enum(['provisioning', 'running', 'deleted', 'failed']),
      address: z.string().nullable().describe('Join address, ip:port, once known'),
    })
    .nullable(),
});

export type GetJobResponse = z.infer<typeof GetJobResponseSchema>;

export async function getEngineJob(
  databaseClient: DatabaseClient,
  s3Client: S3Client,
  id: string
): Promise<GetJobResponse | undefined> {
  const row = await getJob(databaseClient, id);
  if (!row) return undefined;
  const server = await getServerByJob(databaseClient, id);
  const meta = row.s3Prefix ? await readJobMeta(s3Client, row.s3Prefix) : undefined;
  return {
    id: row.id,
    projectId: row.projectId,
    version: row.version,
    status: GetJobResponseSchema.shape.status.parse(row.status),
    error: row.error,
    result: row.s3Prefix && meta ? { ...meta, s3Prefix: row.s3Prefix } : null,
    server: server
      ? {
          id: server.id,
          status: GetJobResponseSchema.shape.server.unwrap().shape.status.parse(server.status),
          address: server.ip ? `${server.ip}:25565` : null,
        }
      : null,
  };
}
