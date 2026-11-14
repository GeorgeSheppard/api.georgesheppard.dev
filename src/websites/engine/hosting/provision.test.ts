import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import type { DatabaseClient } from '@core/database/client.js';
import type { HostingProvider } from './hetzner-client.js';
import type { EngineJobMeta } from '../types.js';

vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: async () => 'https://signed' }));
vi.mock('../repository.js');
import {
  countActiveServers,
  getActiveServersForProject,
  insertServer,
  updateServer,
  type EngineServerRow,
} from '../repository.js';
import { provisionServer } from './provision.js';

const provider: HostingProvider = {
  createServer: vi.fn(),
  getServer: vi.fn(),
  deleteServer: vi.fn(),
};
const deps = {
  databaseClient: {} as DatabaseClient,
  s3Client: {} as S3Client,
  provider,
  maxServers: 3,
};
const meta: EngineJobMeta = {
  pluginId: 'p',
  name: 'P',
  summary: '',
  mcVersion: '1.21.1',
  loader: 'paper',
  artifacts: ['Dockerfile', 'plugin.jar', 'source.zip'],
  projectId: 'proj',
  version: 2,
  prompts: [],
};
const oldServer = { id: 'old', jobId: 'j1', hetznerId: '7', status: 'running' } as EngineServerRow;

describe('provisionServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(countActiveServers).mockResolvedValue(0);
    vi.mocked(getActiveServersForProject).mockResolvedValue([]);
    vi.mocked(insertServer).mockResolvedValue({ id: 'new' } as EngineServerRow);
    vi.mocked(provider.createServer).mockResolvedValue({ id: '9', status: 'provisioning' });
  });

  it('creates a server that downloads everything except the source archive', async () => {
    await provisionServer('job2', 'proj', 'engine/proj/v2/', meta, deps);
    const userData = vi.mocked(provider.createServer).mock.calls[0][0].userData;
    expect(userData).toContain("'Dockerfile'");
    expect(userData).toContain("'plugin.jar'");
    expect(userData).not.toContain('source.zip');
    expect(updateServer).toHaveBeenCalledWith(deps.databaseClient, 'new', {
      hetznerId: '9',
      ip: null,
    });
  });

  it("excludes the project's own server from the limit and replaces it", async () => {
    vi.mocked(getActiveServersForProject).mockResolvedValue([oldServer]);
    await provisionServer('job2', 'proj', 'engine/proj/v2/', meta, deps);
    expect(countActiveServers).toHaveBeenCalledWith(deps.databaseClient, 'proj');
    expect(provider.deleteServer).toHaveBeenCalledWith('7');
    expect(updateServer).toHaveBeenCalledWith(deps.databaseClient, 'old', { status: 'deleted' });
  });

  it('keeps the old server when the new one cannot be created', async () => {
    vi.mocked(getActiveServersForProject).mockResolvedValue([oldServer]);
    vi.mocked(provider.createServer).mockRejectedValue(new Error('no capacity'));
    await expect(provisionServer('job2', 'proj', 'engine/proj/v2/', meta, deps)).rejects.toThrow(
      'no capacity'
    );
    expect(provider.deleteServer).not.toHaveBeenCalled();
    expect(updateServer).toHaveBeenCalledWith(deps.databaseClient, 'new', { status: 'failed' });
  });

  it('refuses when the server limit is reached', async () => {
    vi.mocked(countActiveServers).mockResolvedValue(3);
    await expect(provisionServer('job2', 'proj', 'engine/proj/v2/', meta, deps)).rejects.toThrow(
      'Too many servers'
    );
    expect(provider.createServer).not.toHaveBeenCalled();
  });
});
