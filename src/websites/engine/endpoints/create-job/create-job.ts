import { z } from 'zod';
import type { DatabaseClient } from '@core/database/client.js';
import { enqueueEngineJob, type QueueClient } from '@core/queue/client.js';
import { countActiveServers, createJob } from '../../repository.js';

export const CreateJobRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000).describe('Plain-language description of the plugin'),
  projectId: z
    .string()
    .uuid()
    .optional()
    .describe('Existing project to change; omit to start a new plugin'),
});

export const CreateJobResponseSchema = z.object({
  jobId: z.string().uuid().describe('Job ID to poll'),
  projectId: z.string().uuid().describe('Project ID, pass it back to keep iterating'),
});

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;
export type CreateJobResponse = z.infer<typeof CreateJobResponseSchema>;

export class CreateJobError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409 | 429
  ) {
    super(message);
  }
}

export async function createEngineJob(
  databaseClient: DatabaseClient,
  queueClient: QueueClient,
  request: CreateJobRequest,
  limits: { maxQueued: number; maxServers: number }
): Promise<CreateJobResponse> {
  if ((await countActiveServers(databaseClient, request.projectId)) >= limits.maxServers) {
    throw new CreateJobError('All servers are in use right now, try again later', 429);
  }
  const outcome = await createJob(databaseClient, limits.maxQueued, request.projectId);
  if (!outcome.ok) {
    if (outcome.reason === 'busy')
      throw new CreateJobError('This project is still being built', 409);
    if (outcome.reason === 'unknown_project') throw new CreateJobError('Project not found', 404);
    throw new CreateJobError('Too many jobs are in progress, try again shortly', 429);
  }
  const { job, baseKey } = outcome;
  enqueueEngineJob(queueClient, {
    jobId: job.id,
    prompt: request.prompt,
    projectId: job.projectId,
    version: job.version,
    baseKey,
  });
  return { jobId: job.id, projectId: job.projectId };
}
