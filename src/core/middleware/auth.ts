import { config } from '@config/index';
import { Context, Next } from 'hono';
import { logger } from '@core/telemetry/logger.js';

export async function authMiddleware(c: Context, next: Next) {
  const providedKey = c.req.header('x-api-key');

  if (providedKey !== config.API_KEY) {
    logger.warn(
      `Rejected request with invalid API key: ${c.req.method} ${new URL(c.req.url).pathname} (key ${providedKey ? 'present but incorrect' : 'missing'})`
    );
    return c.json(
      {
        error: 'Invalid API credentials!',
      },
      401
    );
  }

  await next();
}
