import { createMiddleware } from 'hono/factory';
import { AdminEnv } from '@core/types/context.js';
import {
  AccessDeniedError,
  getAccessConfig,
  verifyAccessJwt,
} from '@core/utils/cloudflare-access.js';
import { logger } from '@core/telemetry/logger.js';

// The admin portal's Worker forwards the Access token under this header when proxying to the API
export const ADMIN_ACCESS_JWT_HEADER = 'x-admin-access-jwt';
const CF_ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';

export const adminAuthMiddleware = createMiddleware<AdminEnv>(async (c, next) => {
  const accessConfig = getAccessConfig();
  if (!accessConfig) {
    return c.json({ error: 'Not found' }, 404);
  }

  const path = new URL(c.req.url).pathname;
  const token = c.req.header(ADMIN_ACCESS_JWT_HEADER) ?? c.req.header(CF_ACCESS_JWT_HEADER);
  if (!token) {
    logger.warn(`Rejected admin request without an Access token: ${c.req.method} ${path}`);
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const email = await verifyAccessJwt(token, accessConfig);
    c.set('adminEmail', email);
  } catch (error) {
    const status = error instanceof AccessDeniedError ? 403 : 401;
    logger.warn(`Rejected admin request (${status}): ${c.req.method} ${path}`, error);
    return c.json({ error: status === 403 ? 'Forbidden' : 'Unauthorized' }, status);
  }

  logger.info(`Admin request by ${c.get('adminEmail')}: ${c.req.method} ${path}`);
  await next();
});
