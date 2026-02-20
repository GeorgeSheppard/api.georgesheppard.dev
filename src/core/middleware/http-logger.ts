import { Context, Next } from 'hono';
import { logger } from '@core/telemetry/logger.js';

export function httpLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const { method, url } = c.req;
    const path = new URL(url).pathname;

    logger.info(`<-- ${method} ${path}`);

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    logger.info(`--> ${method} ${path} ${status} ${duration}ms`);
  };
}
