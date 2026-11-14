import { z } from 'zod';
import type { DatabaseClient } from '@core/database/client.js';
import { serverName } from '../../hosting/provision.js';
import { listServers } from '../../repository.js';

export const MINECRAFT_PORT = 25565;

export const ServerSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  name: z.string(),
  status: z.enum(['provisioning', 'running', 'deleted', 'failed']),
  ip: z.string().nullable().describe('Public IPv4 address'),
  address: z.string().nullable().describe('Join address, ip:port'),
  createdUtc: z.string().datetime(),
  lastActiveUtc: z.string().datetime(),
});

export const ListServersResponseSchema = z.object({ servers: z.array(ServerSchema) });
export type ListServersResponse = z.infer<typeof ListServersResponseSchema>;

export async function listEngineServers(
  databaseClient: DatabaseClient
): Promise<ListServersResponse> {
  const rows = await listServers(databaseClient);
  return {
    servers: rows.map((r) => ({
      id: r.id,
      jobId: r.jobId,
      name: serverName(r.jobId),
      status: ServerSchema.shape.status.parse(r.status),
      ip: r.ip,
      address: r.ip ? `${r.ip}:${MINECRAFT_PORT}` : null,
      createdUtc: r.createdUtc.toISOString(),
      lastActiveUtc: r.lastActiveUtc.toISOString(),
    })),
  };
}
