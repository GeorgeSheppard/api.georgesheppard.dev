import { z } from 'zod';
import type { DatabaseClient } from '@core/database/client.js';
import { getJob } from '../../repository.js';

export const GetJobParamsSchema = z.object({ id: z.string().uuid().describe('Job ID') });

export const GetJobResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  logs: z.array(z.string()),
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
  createdUtc: z.string().datetime(),
});

export type GetJobResponse = z.infer<typeof GetJobResponseSchema>;

export async function getSiloJob(
  databaseClient: DatabaseClient,
  id: string
): Promise<GetJobResponse | undefined> {
  const row = await getJob(databaseClient, id);
  if (!row) return undefined;
  const status = GetJobResponseSchema.shape.status.parse(row.status);
  return {
    id: row.id,
    status,
    logs: row.logs,
    error: row.error,
    result: row.result,
    createdUtc: row.createdUtc.toISOString(),
  };
}
