import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { OpenAPIHono } from '@hono/zod-openapi';
import { exchangeCodeForTokens } from '@core/utils/cognito-oauth.js';
import { verifyCognitoIdToken } from '@core/utils/cognito-jwt.js';
import { encryptSession } from '@core/utils/session-cookie.js';
import { config } from '@config/index.js';
import { logger } from '@core/telemetry/logger.js';

const SESSION_COOKIE_MAX_AGE = 2592000;

function frontendUrl(): string {
  return config.NODE_ENV === 'production' ? config.FRONTEND_URL_PROD : config.FRONTEND_URL_DEV;
}

function clearOauthCookies(c: Context) {
  deleteCookie(c, 'oauth_state', { path: '/' });
  deleteCookie(c, 'oauth_nonce', { path: '/' });
  deleteCookie(c, 'oauth_redirect', { path: '/' });
}

export async function callback(
  c: Context,
  query: { code?: string; state?: string }
): Promise<string> {
  const storedState = getCookie(c, 'oauth_state');
  const storedNonce = getCookie(c, 'oauth_nonce');
  const redirectTo = getCookie(c, 'oauth_redirect') ?? frontendUrl();

  clearOauthCookies(c);

  if (!query.code || !query.state || !storedState || query.state !== storedState) {
    logger.warn('OAuth callback failed state validation');
    return `${frontendUrl()}?error=auth_failed`;
  }

  try {
    const tokens = await exchangeCodeForTokens(query.code, `${config.BACKEND_URL}/auth/callback`);
    const idTokenPayload = await verifyCognitoIdToken(tokens.id_token);

    if (storedNonce && idTokenPayload.nonce !== storedNonce) {
      logger.warn('OAuth callback failed nonce validation');
      return `${frontendUrl()}?error=auth_failed`;
    }

    if (!tokens.refresh_token) {
      logger.warn('Cognito did not return a refresh token');
      return `${frontendUrl()}?error=auth_failed`;
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
      sameSite: 'Lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    });

    return redirectTo;
  } catch (error) {
    logger.error('OAuth callback failed:', error);
    return `${frontendUrl()}?error=auth_failed`;
  }
}

export function registerCallbackRoute(app: OpenAPIHono) {
  app.get('/auth/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const redirectTo = await callback(c, { code, state });
    return c.redirect(redirectTo, 302);
  });
}
