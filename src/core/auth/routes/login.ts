import { randomBytes } from 'node:crypto';
import { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { buildAuthorizeUrl } from '@core/utils/cognito-oauth.js';
import { resolveRedirectUri } from '../redirect.js';
import { config } from '@config/index.js';

const OAUTH_COOKIE_MAX_AGE = 600;

const QuerySchema = z.object({
  redirect_uri: z
    .string()
    .optional()
    .describe('Frontend URL to return to after login; must be in the allowed origin list'),
});

const route = createRoute({
  method: 'get',
  path: '/auth/login',
  tags: ['auth'],
  request: { query: QuerySchema },
  responses: {
    302: {
      description:
        'Redirects the browser to the Cognito hosted UI authorize endpoint. Sets oauth_state, oauth_nonce and oauth_redirect cookies.',
    },
  },
});

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
  setCookie(c, 'oauth_redirect', resolveRedirectUri(redirectUri), oauthCookieOptions());

  return buildAuthorizeUrl({
    state,
    nonce,
    redirectUri: `${config.BACKEND_URL}/auth/callback`,
  });
}

export function registerLoginRoute(app: OpenAPIHono) {
  app.openapi(route, (c) => {
    const { redirect_uri } = c.req.valid('query');
    const authorizeUrl = login(c, redirect_uri);
    return c.redirect(authorizeUrl, 302);
  });
}
