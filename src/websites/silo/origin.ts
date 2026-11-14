import { createMiddleware } from 'hono/factory';
import { config } from '@config/index.js';

const SILO_ORIGINS = ['https://engine.georgesheppard.dev'];
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

export function isSiloOrigin(origin: string | undefined): origin is string {
  if (!origin) return false;
  return (
    SILO_ORIGINS.includes(origin) ||
    (config.NODE_ENV !== 'production' && DEV_ORIGINS.includes(origin))
  );
}

export const siloOriginGuard = createMiddleware(async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  if (!isSiloOrigin(c.req.header('Origin'))) return c.json({ error: 'Origin not allowed' }, 403);
  return next();
});
