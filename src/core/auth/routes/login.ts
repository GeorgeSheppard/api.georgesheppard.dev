import { randomBytes } from 'node:crypto';
import { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { OpenAPIHono } from '@hono/zod-openapi';
import { buildAuthorizeUrl } from '@core/utils/cognito-oauth.js';
import { config } from '@config/index.js';

const OAUTH_COOKIE_MAX_AGE = 600;

function frontendUrl(): string {
  return config.NODE_ENV === 'production' ? config.FRONTEND_URL_PROD : config.FRONTEND_URL_DEV;
}

function oauthCookieOptions() {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'Lax' as const,
    maxAge: OAUTH_COOKIE_MAX_AGE,
    path: '/',
  };
}

export function login(c: Context, redirectUri?: string): string {
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');

  setCookie(c, 'oauth_state', state, oauthCookieOptions());
  setCookie(c, 'oauth_nonce', nonce, oauthCookieOptions());
  setCookie(c, 'oauth_redirect', redirectUri ?? frontendUrl(), oauthCookieOptions());

  return buildAuthorizeUrl({
    state,
    nonce,
    redirectUri: `${config.BACKEND_URL}/auth/callback`,
  });
}

export function registerLoginRoute(app: OpenAPIHono) {
  app.get('/auth/login', (c) => {
    const redirectUri = c.req.query('redirect_uri');
    const authorizeUrl = login(c, redirectUri);
    return c.redirect(authorizeUrl, 302);
  });
}
