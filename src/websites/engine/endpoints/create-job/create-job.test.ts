import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DatabaseClient } from '@core/database/client.js';
import type { QueueClient } from '@core/queue/client.js';
import { createEngineJob, QueueFullError, CreateJobRequestSchema } from './create-job.js';

vi.mock('../../repository.js');
import { countActiveServers, createJob } from '../../repository.js';

const queueClient = {
  engineQueue: 'engine-jobs',
  channel: { sendToQueue: vi.fn() },
} as unknown as QueueClient;
const databaseClient = {} as DatabaseClient;

describe('createEngineJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(countActiveServers).mockResolvedValue(0);
  });
  const limits = { maxQueued: 5, maxServers: 3 };

  it('creates a job and enqueues it', async () => {
    vi.mocked(createJob).mockResolvedValue({ id: 'abc' } as Awaited<ReturnType<typeof createJob>>);
    const res = await createEngineJob(databaseClient, queueClient, { prompt: 'a sword' }, limits);
    expect(res).toEqual({ jobId: 'abc' });
    expect(queueClient.channel.sendToQueue).toHaveBeenCalledWith(
      'engine-jobs',
      Buffer.from(JSON.stringify({ jobId: 'abc', prompt: 'a sword' })),
      { persistent: true }
    );
  });

  it('rejects when too many jobs are in progress', async () => {
    vi.mocked(createJob).mockResolvedValue(undefined);
    await expect(
      createEngineJob(databaseClient, queueClient, { prompt: 'x' }, limits)
    ).rejects.toBeInstanceOf(QueueFullError);
    expect(queueClient.channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('rejects when all servers are in use', async () => {
    vi.mocked(countActiveServers).mockResolvedValue(3);
    await expect(
      createEngineJob(databaseClient, queueClient, { prompt: 'x' }, limits)
    ).rejects.toBeInstanceOf(QueueFullError);
    expect(createJob).not.toHaveBeenCalled();
  });

  it('validates the prompt', () => {
    expect(CreateJobRequestSchema.safeParse({ prompt: '  ' }).success).toBe(false);
    expect(CreateJobRequestSchema.safeParse({ prompt: 'x'.repeat(4001) }).success).toBe(false);
  });
});
