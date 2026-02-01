import { createMiddleware } from 'hono/factory';
import { verifyJwt } from '@core/utils/jwt.js';
import { ProtectedEnv } from '@core/types/context.js';

export const jwtAuthMiddleware = createMiddleware<ProtectedEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        error: 'Missing or invalid Authorization header',
      },
      401
    );
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyJwt(token);
    c.set('userId', payload.userId);
    await next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    return c.json(
      {
        error: `Token validation failed: ${message}`,
      },
      401
    );
  }
});
