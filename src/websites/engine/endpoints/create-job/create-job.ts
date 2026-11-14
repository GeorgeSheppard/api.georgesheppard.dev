import { z } from 'zod';
import type { DatabaseClient } from '@core/database/client.js';
import { enqueueEngineJob, type QueueClient } from '@core/queue/client.js';
import { createJob } from '../../repository.js';

export const CreateJobRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000).describe('Plain-language description of the plugin'),
});

export const CreateJobResponseSchema = z.object({
  jobId: z.string().uuid().describe('Job ID to poll'),
});

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;
export type CreateJobResponse = z.infer<typeof CreateJobResponseSchema>;

export class QueueFullError extends Error {}

export async function createEngineJob(
  databaseClient: DatabaseClient,
  queueClient: QueueClient,
  request: CreateJobRequest,
  maxQueued: number
): Promise<CreateJobResponse> {
  const job = await createJob(databaseClient, maxQueued);
  if (!job) throw new QueueFullError('Too many jobs are in progress, try again shortly');
  enqueueEngineJob(queueClient, { jobId: job.id, prompt: request.prompt });
  return { jobId: job.id };
}
