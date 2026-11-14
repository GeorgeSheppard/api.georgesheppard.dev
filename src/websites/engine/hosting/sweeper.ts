import type { DatabaseClient } from '@core/database/client.js';
import { logger } from '@core/telemetry/logger.js';
import { getServer, listServers, updateServer, type EngineServerRow } from '../repository.js';
import type { HostingProvider } from './hetzner-client.js';

export interface SweepDeps {
  databaseClient: DatabaseClient;
  provider: HostingProvider;
  ping: (host: string) => Promise<number | undefined>;
  idleMinutes: number;
  maxHours: number;
  now?: () => Date;
}

const MINUTE = 60_000;

const serverLogger = (server: EngineServerRow) =>
  logger.child({ 'engine.job_id': server.jobId, 'engine.server_id': server.id });

export async function destroyServer(
  { databaseClient, provider }: Pick<SweepDeps, 'databaseClient' | 'provider'>,
  server: EngineServerRow,
  reason: string
): Promise<void> {
  if (server.hetznerId) await provider.deleteServer(server.hetznerId);
  await updateServer(databaseClient, server.id, { status: 'deleted' });
  serverLogger(server).info(`Deleted engine server (${reason})`);
}

export async function deleteServerById(deps: SweepDeps, id: string): Promise<boolean> {
  const server = await getServer(deps.databaseClient, id);
  if (!server || server.status === 'deleted' || server.status === 'failed') return false;
  await destroyServer(deps, server, 'manual');
  return true;
}

async function sweepOne(deps: SweepDeps, server: EngineServerRow, now: Date): Promise<void> {
  const { databaseClient, provider } = deps;
  if (server.hetznerId) {
    const hosted = await provider.getServer(server.hetznerId);
    if (!hosted) {
      await updateServer(databaseClient, server.id, { status: 'deleted' });
      serverLogger(server).info('Engine server no longer exists at the provider');
      return;
    }
    if (hosted.ip && hosted.ip !== server.ip) {
      server = { ...server, ip: hosted.ip };
      await updateServer(databaseClient, server.id, { ip: hosted.ip });
    }
    if (hosted.status === 'running' && server.status === 'provisioning') {
      server = { ...server, status: 'running' };
      await updateServer(databaseClient, server.id, { status: 'running' });
    }
  }

  const ageMs = now.getTime() - server.createdUtc.getTime();
  if (ageMs >= deps.maxHours * 60 * MINUTE) return destroyServer(deps, server, 'max-age');

  let lastActive = server.lastActiveUtc;
  if (server.ip && server.status === 'running') {
    const players = await deps.ping(server.ip);
    if (players && players > 0) {
      lastActive = now;
      await updateServer(databaseClient, server.id, { lastActiveUtc: now });
    }
  }
  if (now.getTime() - lastActive.getTime() >= deps.idleMinutes * MINUTE) {
    return destroyServer(deps, server, 'idle');
  }
}

export async function sweepServers(deps: SweepDeps): Promise<void> {
  const now = (deps.now ?? (() => new Date()))();
  for (const server of await listServers(deps.databaseClient, { activeOnly: true })) {
    try {
      await sweepOne(deps, server, now);
    } catch (e) {
      serverLogger(server).error('Sweep failed for engine server', e);
    }
  }
}
