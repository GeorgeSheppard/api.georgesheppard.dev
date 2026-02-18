import { createMiddleware } from 'hono/factory';
import { verifyJwt } from '@core/utils/jwt.js';
import { verifyCognitoJwt } from '@core/utils/cognito-jwt.js';
import { ProtectedEnv } from '@core/types/context.js';
import { logger } from '@core/telemetry/logger.js';

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
  let userId: string | null = null;

  // Try Cognito JWT first
  if (userId === null) {
    try {
      const payload = await verifyCognitoJwt(token);
      userId = payload.sub;
    } catch (error) {
      logger.info('Cognito JWT verification failed:', error);
    }
  }

  // Try own JWT if Cognito failed
  if (userId === null) {
    try {
      const payload = await verifyJwt(token);
      userId = payload.userId;
    } catch (error) {
      logger.info('Internal JWT verification failed:', error);
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
