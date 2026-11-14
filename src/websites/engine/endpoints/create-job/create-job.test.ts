import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DatabaseClient } from '@core/database/client.js';
import type { QueueClient } from '@core/queue/client.js';
import { createEngineJob, CreateJobError, CreateJobRequestSchema } from './create-job.js';

vi.mock('../../repository.js');
import { countActiveServers, createJob } from '../../repository.js';

const queueClient = {
  engineQueue: 'engine-jobs',
  channel: { sendToQueue: vi.fn() },
} as unknown as QueueClient;
const databaseClient = {} as DatabaseClient;
const limits = { maxQueued: 5, maxServers: 3 };
const projectId = '660e8400-e29b-41d4-a716-446655440000';
const job = { id: 'abc', projectId, version: 1, status: 'queued', s3Prefix: null, error: null };

describe('createEngineJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(countActiveServers).mockResolvedValue(0);
  });

  it('creates a new project job and enqueues it', async () => {
    vi.mocked(createJob).mockResolvedValue({ ok: true, job });
    const res = await createEngineJob(databaseClient, queueClient, { prompt: 'a sword' }, limits);
    expect(res).toEqual({ jobId: 'abc', projectId });
    expect(createJob).toHaveBeenCalledWith(databaseClient, 5, undefined);
    expect(queueClient.channel.sendToQueue).toHaveBeenCalledWith(
      'engine-jobs',
      Buffer.from(JSON.stringify({ jobId: 'abc', prompt: 'a sword', projectId, version: 1 })),
      { persistent: true }
    );
  });

  it('passes the previous version to the worker when iterating', async () => {
    vi.mocked(createJob).mockResolvedValue({
      ok: true,
      job: { ...job, version: 2 },
      baseKey: `engine/${projectId}/v1/`,
    });
    await createEngineJob(databaseClient, queueClient, { prompt: 'faster', projectId }, limits);
    expect(countActiveServers).toHaveBeenCalledWith(databaseClient, projectId);
    const sent = JSON.parse(vi.mocked(queueClient.channel.sendToQueue).mock.calls[0][1].toString());
    expect(sent).toMatchObject({ version: 2, baseKey: `engine/${projectId}/v1/` });
  });

  it.each([
    ['full', 429],
    ['busy', 409],
    ['unknown_project', 404],
  ] as const)('maps %s to HTTP %i', async (reason, status) => {
    vi.mocked(createJob).mockResolvedValue({ ok: false, reason });
    const err = await createEngineJob(databaseClient, queueClient, { prompt: 'x' }, limits).catch(
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(CreateJobError);
    expect((err as CreateJobError).status).toBe(status);
    expect(queueClient.channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('rejects when all servers are in use', async () => {
    vi.mocked(countActiveServers).mockResolvedValue(3);
    await expect(
      createEngineJob(databaseClient, queueClient, { prompt: 'x' }, limits)
    ).rejects.toMatchObject({ status: 429 });
    expect(createJob).not.toHaveBeenCalled();
  });

  it('validates the request', () => {
    expect(CreateJobRequestSchema.safeParse({ prompt: '  ' }).success).toBe(false);
    expect(CreateJobRequestSchema.safeParse({ prompt: 'x'.repeat(4001) }).success).toBe(false);
    expect(CreateJobRequestSchema.safeParse({ prompt: 'x', projectId: 'nope' }).success).toBe(
      false
    );
  });
});
