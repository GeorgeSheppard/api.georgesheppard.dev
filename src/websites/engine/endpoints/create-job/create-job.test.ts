import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DatabaseClient } from '@core/database/client.js';
import type { QueueClient } from '@core/queue/client.js';
import { createEngineJob, QueueFullError, CreateJobRequestSchema } from './create-job.js';

vi.mock('../../repository.js');
import { createJob } from '../../repository.js';

const queueClient = {
  engineQueue: 'engine-jobs',
  channel: { sendToQueue: vi.fn() },
} as unknown as QueueClient;
const databaseClient = {} as DatabaseClient;

describe('createEngineJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a job and enqueues it', async () => {
    vi.mocked(createJob).mockResolvedValue({ id: 'abc' } as Awaited<ReturnType<typeof createJob>>);
    const res = await createEngineJob(databaseClient, queueClient, { prompt: 'a sword' }, 5);
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
      createEngineJob(databaseClient, queueClient, { prompt: 'x' }, 5)
    ).rejects.toBeInstanceOf(QueueFullError);
    expect(queueClient.channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('validates the prompt', () => {
    expect(CreateJobRequestSchema.safeParse({ prompt: '  ' }).success).toBe(false);
    expect(CreateJobRequestSchema.safeParse({ prompt: 'x'.repeat(4001) }).success).toBe(false);
  });
});
