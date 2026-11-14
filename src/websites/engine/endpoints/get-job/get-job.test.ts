import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import type { DatabaseClient } from '@core/database/client.js';
import { getEngineJob } from './get-job.js';

vi.mock('../../repository.js');
vi.mock('../../generation/job-meta.js');
import { getJob, getServerByJob } from '../../repository.js';
import { readJobMeta } from '../../generation/job-meta.js';

const db = {} as DatabaseClient;
const s3 = {} as S3Client;
const id = '550e8400-e29b-41d4-a716-446655440000';
const projectId = '660e8400-e29b-41d4-a716-446655440000';
const row = (over: object) => ({
  id,
  projectId,
  version: 1,
  status: 'queued',
  s3Prefix: null,
  error: null,
  ...over,
});

describe('getEngineJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerByJob).mockResolvedValue(undefined);
  });

  it('returns undefined for an unknown job', async () => {
    vi.mocked(getJob).mockResolvedValue(undefined);
    expect(await getEngineJob(db, s3, id)).toBeUndefined();
  });

  it('returns status only while the job is not finished', async () => {
    vi.mocked(getJob).mockResolvedValue(row({ status: 'running' }));
    expect(await getEngineJob(db, s3, id)).toEqual({
      id,
      projectId,
      version: 1,
      status: 'running',
      error: null,
      result: null,
      server: null,
    });
    expect(readJobMeta).not.toHaveBeenCalled();
  });

  it('reads the result metadata from S3 once the job has succeeded', async () => {
    vi.mocked(getJob).mockResolvedValue(row({ status: 'succeeded', s3Prefix: `engine/${id}/` }));
    vi.mocked(readJobMeta).mockResolvedValue({
      pluginId: 'p',
      name: 'Boots',
      summary: 'Jump',
      mcVersion: '1.21.1',
      loader: 'paper',
      artifacts: ['Dockerfile'],
      projectId,
      version: 1,
      prompts: ['boots'],
    });
    const res = await getEngineJob(db, s3, id);
    expect(res?.result).toMatchObject({ name: 'Boots', s3Prefix: `engine/${id}/` });
  });

  it('returns the error for a failed job', async () => {
    vi.mocked(getJob).mockResolvedValue(row({ status: 'failed', error: 'nope' }));
    expect((await getEngineJob(db, s3, id))?.error).toBe('nope');
  });
});
