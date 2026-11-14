import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DatabaseClient } from '@core/database/client.js';
import { sweepServers, type SweepDeps } from './sweeper.js';
import type { HostingProvider } from './hetzner-client.js';
import type { EngineServerRow } from '../repository.js';

const { info } = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock('@core/telemetry/logger.js', () => ({
  logger: { child: () => ({ info, error: vi.fn() }) },
}));
vi.mock('../repository.js');
import { listServers, updateServer } from '../repository.js';

const t0 = new Date('2026-01-01T00:00:00Z');
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

const server = (over: Partial<EngineServerRow> = {}): EngineServerRow => ({
  id: 's1',
  jobId: 'j1',
  hetznerId: '42',
  status: 'running',
  ip: '1.2.3.4',
  createdUtc: t0,
  lastActiveUtc: t0,
  ...over,
});

const provider: HostingProvider = {
  createServer: vi.fn(),
  getServer: vi.fn(),
  deleteServer: vi.fn(),
};

const deps = (ping: SweepDeps['ping'], now: Date): SweepDeps => ({
  databaseClient: {} as DatabaseClient,
  provider,
  ping,
  idleMinutes: 30,
  maxHours: 6,
  now: () => now,
});

describe('sweepServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(provider.getServer).mockResolvedValue({ id: '42', status: 'running', ip: '1.2.3.4' });
  });

  it('keeps a server with players online and records activity', async () => {
    vi.mocked(listServers).mockResolvedValue([server()]);
    await sweepServers(deps(async () => 2, at(45)));
    expect(provider.deleteServer).not.toHaveBeenCalled();
    expect(updateServer).toHaveBeenCalledWith(expect.anything(), 's1', { lastActiveUtc: at(45) });
  });

  it('deletes a server idle past the limit', async () => {
    vi.mocked(listServers).mockResolvedValue([server()]);
    await sweepServers(deps(async () => 0, at(31)));
    expect(provider.deleteServer).toHaveBeenCalledWith('42');
    expect(updateServer).toHaveBeenCalledWith(expect.anything(), 's1', { status: 'deleted' });
    expect(info).toHaveBeenCalledWith(expect.stringContaining('idle'));
  });

  it('keeps a recently active server', async () => {
    vi.mocked(listServers).mockResolvedValue([server({ lastActiveUtc: at(20) })]);
    await sweepServers(deps(async () => 0, at(31)));
    expect(provider.deleteServer).not.toHaveBeenCalled();
  });

  it('deletes servers older than the max age even with players', async () => {
    vi.mocked(listServers).mockResolvedValue([server({ lastActiveUtc: at(359) })]);
    await sweepServers(deps(async () => 5, at(361)));
    expect(provider.deleteServer).toHaveBeenCalledWith('42');
    expect(updateServer).toHaveBeenCalledWith(expect.anything(), 's1', { status: 'deleted' });
    expect(info).toHaveBeenCalledWith(expect.stringContaining('max-age'));
  });

  it('marks servers deleted outside the app as gone', async () => {
    vi.mocked(listServers).mockResolvedValue([server()]);
    vi.mocked(provider.getServer).mockResolvedValue(undefined);
    await sweepServers(deps(async () => 0, at(1)));
    expect(provider.deleteServer).not.toHaveBeenCalled();
    expect(updateServer).toHaveBeenCalledWith(expect.anything(), 's1', { status: 'deleted' });
  });

  it('records the IP and running state once Hetzner reports them', async () => {
    vi.mocked(listServers).mockResolvedValue([server({ status: 'provisioning', ip: null })]);
    await sweepServers(deps(async () => undefined, at(2)));
    expect(updateServer).toHaveBeenCalledWith(expect.anything(), 's1', { ip: '1.2.3.4' });
    expect(updateServer).toHaveBeenCalledWith(expect.anything(), 's1', { status: 'running' });
  });

  it('keeps sweeping other servers when one fails', async () => {
    vi.mocked(listServers).mockResolvedValue([
      server({ id: 'a', hetznerId: '1' }),
      server({ id: 'b', hetznerId: '2', lastActiveUtc: t0 }),
    ]);
    vi.mocked(provider.getServer).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(provider.getServer).mockResolvedValueOnce({
      id: '2',
      status: 'running',
      ip: '1.2.3.4',
    });
    await sweepServers(deps(async () => 0, at(40)));
    expect(provider.deleteServer).toHaveBeenCalledWith('2');
  });
});
