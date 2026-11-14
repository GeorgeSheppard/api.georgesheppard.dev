import { config } from '@config/index.js';
import { HetznerProvider, type HostingProvider } from './hetzner-client.js';
import { pingPlayerCount } from './status-ping.js';
import type { SweepDeps } from './sweeper.js';
import type { DatabaseClient } from '@core/database/client.js';

export const createHostingProvider = (): HostingProvider =>
  new HetznerProvider({
    token: config.HETZNER_API_TOKEN,
    serverType: config.ENGINE_SERVER_TYPE,
    location: config.ENGINE_LOCATION,
    firewallId: config.HETZNER_FIREWALL_ID,
  });

export const createSweepDeps = (databaseClient: DatabaseClient): SweepDeps => ({
  databaseClient,
  provider: createHostingProvider(),
  ping: (host) => pingPlayerCount(host),
  idleMinutes: config.ENGINE_IDLE_MINUTES,
  maxHours: config.ENGINE_MAX_HOURS,
});
