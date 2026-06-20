import { createMiddleware } from 'hono/factory';
import { verifyJwt } from '@core/utils/jwt.js';
import { verifyCognitoJwt } from '@core/utils/cognito-jwt.js';
import { ProtectedEnv } from '@core/types/context.js';
import { logger } from '@core/telemetry/logger.js';
import { getCookie } from 'hono/cookie';
import { decryptSession } from '@core/utils/session-cookie';

export const jwtAuthMiddleware = createMiddleware<ProtectedEnv>(async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return next();
  }

  const sessionCookie = getCookie(c, 'session');
  const authHeader = c.req.header('Authorization');

  if (!sessionCookie && !authHeader) {
    return c.json(
      {
        error: 'Missing authentication method',
      },
      401
    );
  }

  let userId: string | null = null;

  // Auth header authentication is only used for MCP
  if (authHeader) {
    if (!authHeader.startsWith('Bearer ')) {
      return c.json(
        {
          error: 'Missing or invalid Bearer Authorization header',
        },
        401
      );
    }

    const token = authHeader.slice(7);

    // This is MCP JWT verification, NOT cognito
    try {
      const payload = await verifyJwt(token);
      userId = payload.userId;
    } catch (error) {
      logger.info('Internal JWT verification failed:', error);
      return c.json(
        {
          error: 'Failed to authenticate Bearer',
        },
        401
      );
    }
  }

  if (sessionCookie) {
    try {
      const session = await decryptSession(sessionCookie);
      userId = session.userId;
    } catch (error) {
      logger.info('Failed to decrypt session cookie:', error);
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  if (userId === null) {
    return c.json(
      {
        error: 'Invalid token: neither Cognito nor internal JWT validation passed',
      },
      401
    );
  }

  c.set('userId', userId);
  await next();
});
