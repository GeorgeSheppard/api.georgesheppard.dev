import { createMiddleware } from 'hono/factory';
import { verifyJwt } from '@core/utils/jwt.js';
import { verifyCognitoJwt, extractUserIdFromCognitoToken } from '@core/utils/cognito-jwt.js';
import { ProtectedEnv } from '@core/types/context.js';

export const hybridJwtAuthMiddleware = createMiddleware<ProtectedEnv>(async (c, next) => {
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
      userId = extractUserIdFromCognitoToken(payload);
    } catch {
      // Cognito verification failed, try own JWT next
    }
  }

  // Try own JWT if Cognito failed
  if (userId === null) {
    try {
      const payload = await verifyJwt(token);
      userId = payload.userId;
    } catch {
      // Both failed
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
