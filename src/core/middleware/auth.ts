import { config } from '@config/index';
import { Context, Next } from 'hono';

export async function authMiddleware(c: Context, next: Next) {
  const providedKey = c.req.header('x-api-key');

  if (providedKey !== config.API_KEY) {
    return c.json(
      {
        error: 'Invalid API credentials!',
      },
      401
    );
  }

  await next();
}
