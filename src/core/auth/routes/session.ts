import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { decryptSession, encryptSession } from '@core/utils/session-cookie.js';
import { refreshTokens } from '@core/utils/cognito-oauth.js';
import { config } from '@config/index.js';
import { logger } from '@core/telemetry/logger.js';

const REFRESH_THRESHOLD_SECONDS = 300;
const SESSION_COOKIE_MAX_AGE = 2592000;

const SessionResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
  }),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: 'get',
  path: '/auth/session',
  tags: ['auth'],
  responses: {
    200: {
      content: { 'application/json': { schema: SessionResponseSchema } },
      description: 'Authenticated',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Not authenticated',
    },
  },
});

export type SessionResult =
  | { status: 200; body: { user: { id: string; email: string } }; refreshedSession?: string }
  | { status: 401; body: { error: string }; clearCookie?: boolean };

export async function getSession(c: Context): Promise<SessionResult> {
  const sessionCookie = getCookie(c, 'session');

  if (!sessionCookie) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  let session;
  try {
    session = await decryptSession(sessionCookie);
  } catch (error) {
    logger.info('Failed to decrypt session cookie:', error);
    return { status: 401, body: { error: 'Unauthorized' }, clearCookie: true };
  }

  const expiresInSeconds = session.expiresAt - Math.floor(Date.now() / 1000);

  if (expiresInSeconds > REFRESH_THRESHOLD_SECONDS) {
    return { status: 200, body: { user: { id: session.userId, email: session.email } } };
  }

  try {
    const tokens = await refreshTokens(session.refreshToken);
    const refreshedSession = await encryptSession({
      userId: session.userId,
      email: session.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? session.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    });

    return {
      status: 200,
      body: { user: { id: session.userId, email: session.email } },
      refreshedSession,
    };
  } catch (error) {
    logger.info('Failed to refresh Cognito tokens:', error);
    return { status: 401, body: { error: 'Unauthorized' }, clearCookie: true };
  }
}

export function registerSessionRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const result = await getSession(c);

    if (result.status === 200) {
      if (result.refreshedSession) {
        setCookie(c, 'session', result.refreshedSession, {
          httpOnly: true,
          secure: config.NODE_ENV === 'production',
          sameSite: config.NODE_ENV === 'production' ? 'None' : 'Lax',
          maxAge: SESSION_COOKIE_MAX_AGE,
          path: '/',
        });
      }
      return c.json(result.body, 200);
    }

    if (result.clearCookie) {
      deleteCookie(c, 'session', { path: '/' });
    }
    return c.json(result.body, 401);
  });
}
