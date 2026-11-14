import { createMiddleware } from 'hono/factory';

const ENGINE_ORIGINS = ['https://engine.georgesheppard.dev'];

export function isEngineOrigin(origin: string | undefined): origin is string {
  return !!origin && ENGINE_ORIGINS.includes(origin);
}

export const engineOriginGuard = createMiddleware(async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  if (!isEngineOrigin(c.req.header('Origin'))) return c.json({ error: 'Origin not allowed' }, 403);
  return next();
});
