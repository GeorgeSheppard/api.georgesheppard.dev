import 'dotenv/config';
import { validateEnv } from './env.js';
import { loadSecretsFromAWS } from './secrets-manager.js';
import type { Env } from './env.js';

let configCache: ReturnType<typeof validateEnv> | null = null;

async function initializeConfig() {
  if (configCache) return configCache;

  await loadSecretsFromAWS();
  configCache = validateEnv();
  return configCache;
}

export function getConfig() {
  if (!configCache) {
    throw new Error('Config not initialized. Call initializeConfig() first.');
  }
  return configCache;
}

// Export a proxy object for backward compatibility with existing imports
// This allows code to use `import { config }` without modification
export const config: Env & {
  DATABASE_URL: string;
  RABBITMQ_URL: string;
} = new Proxy({} as any, {
  get: (_, prop) => {
    return (getConfig() as any)[prop];
  },
});

export { initializeConfig };
