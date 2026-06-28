import { randomBytes } from 'node:crypto';
import { OpenAPIHono } from '@hono/zod-openapi';
import { setCookie } from 'hono/cookie';
import { z } from 'zod';
import { config } from '@config/index.js';
import { buildAuthorizeUrlForClient } from '@core/utils/cognito-oauth.js';
import { decodeClientId, encodeAuthorizeRequest } from './client-credentials.js';

const AUTHORIZE_COOKIE_MAX_AGE = 600;

const QuerySchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string().url(),
  state: z.string(),
  code_challenge: z.string(),
  code_challenge_method: z.literal('S256'),
});

export function registerMcpOauthAuthorizeRoute(app: OpenAPIHono) {
  app.get('/mcp/authorize', async (c) => {
    const parsed = QuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: 'invalid_request' }, 400);
    }

    const { client_id, redirect_uri, state, code_challenge } = parsed.data;

    let decodedClientId;
    try {
      decodedClientId = await decodeClientId(client_id);
    } catch {
      return c.json({ error: 'invalid_client' }, 401);
    }

    if (!decodedClientId.redirectUris.includes(redirect_uri)) {
      return c.json(
        { error: 'invalid_request', error_description: 'Unregistered redirect_uri' },
        400
      );
    }

    const nonce = randomBytes(32).toString('base64url');

    const authorizeRequest = await encodeAuthorizeRequest({
      clientId: client_id,
      redirectUri: redirect_uri,
      state,
      nonce,
      codeChallenge: code_challenge,
    });

    setCookie(c, 'mcp_oauth_request', authorizeRequest, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: AUTHORIZE_COOKIE_MAX_AGE,
      path: '/mcp',
    });

    const cognitoAuthorizeUrl = buildAuthorizeUrlForClient({
      clientId: decodedClientId.cognitoClientId,
      state,
      nonce,
      redirectUri: `${config.BACKEND_URL}/mcp/callback`,
    });

    return c.redirect(cognitoAuthorizeUrl, 302);
  });
}
