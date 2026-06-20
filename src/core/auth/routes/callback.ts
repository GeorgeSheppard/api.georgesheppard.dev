import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { exchangeCodeForTokens } from '@core/utils/cognito-oauth.js';
import { verifyCognitoIdToken } from '@core/utils/cognito-jwt.js';
import { encryptSession } from '@core/utils/session-cookie.js';
import { resolveRedirectUri } from '../redirect.js';
import { config } from '@config/index.js';
import { logger } from '@core/telemetry/logger.js';

const SESSION_COOKIE_MAX_AGE = 2592000;

const QuerySchema = z.object({
  code: z.string().optional().describe('Authorization code returned by Cognito'),
  state: z.string().optional().describe('Must match the oauth_state cookie set during login'),
});

const route = createRoute({
  method: 'get',
  path: '/auth/callback',
  tags: ['auth'],
  request: { query: QuerySchema },
  responses: {
    302: {
      description:
        'Redirects to the stored frontend URL on success (with a session cookie set), or to the same URL with ?error=auth_failed on failure.',
    },
  },
});

function clearOauthCookies(c: Context) {
  deleteCookie(c, 'oauth_state', { path: '/' });
  deleteCookie(c, 'oauth_nonce', { path: '/' });
  deleteCookie(c, 'oauth_redirect', { path: '/' });
}

function withAuthError(redirectTo: string): string {
  const target = new URL(redirectTo);
  target.searchParams.set('error', 'auth_failed');
  return target.toString();
}

export async function callback(
  c: Context,
  query: { code?: string; state?: string }
): Promise<string> {
  const storedState = getCookie(c, 'oauth_state');
  const storedNonce = getCookie(c, 'oauth_nonce');
  const redirectTo = resolveRedirectUri(getCookie(c, 'oauth_redirect'));

  clearOauthCookies(c);

  if (!query.code || !query.state || !storedState || query.state !== storedState) {
    logger.warn('OAuth callback failed state validation');
    return withAuthError(redirectTo);
  }

  try {
    const tokens = await exchangeCodeForTokens(query.code, `${config.BACKEND_URL}/auth/callback`);
    const idTokenPayload = await verifyCognitoIdToken(tokens.id_token);

    if (storedNonce && idTokenPayload.nonce !== storedNonce) {
      logger.warn('OAuth callback failed nonce validation');
      return withAuthError(redirectTo);
    }

    if (!tokens.refresh_token) {
      logger.warn('Cognito did not return a refresh token');
      return withAuthError(redirectTo);
    }

    const session = await encryptSession({
      userId: idTokenPayload.sub,
      email: idTokenPayload.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    });

    setCookie(c, 'session', session, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: config.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    });

    return redirectTo;
  } catch (error) {
    logger.error('OAuth callback failed:', error);
    return withAuthError(redirectTo);
  }
}

export function registerCallbackRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { code, state } = c.req.valid('query');
    const redirectTo = await callback(c, { code, state });
    return c.redirect(redirectTo, 302);
  });
}
