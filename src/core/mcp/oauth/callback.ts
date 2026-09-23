import { OpenAPIHono } from '@hono/zod-openapi';
import { getCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { config } from '@config/index.js';
import { exchangeCodeForTokensForClient } from '@core/utils/cognito-oauth.js';
import { verifyCognitoIdTokenForClient } from '@core/utils/cognito-jwt.js';
import { logger } from '@core/telemetry/logger.js';
import { decodeClientId, decodeAuthorizeRequest, encodeAuthCode } from './client-credentials.js';

const QuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
});

function withError(redirectTo: string, state: string): string {
  const url = new URL(redirectTo);
  url.searchParams.set('error', 'access_denied');
  url.searchParams.set('state', state);
  return url.toString();
}

export function registerMcpOauthCallbackRoute(app: OpenAPIHono) {
  app.get('/mcp/callback', async (c) => {
    const { code, state } = QuerySchema.parse(c.req.query());

    const requestCookie = getCookie(c, 'mcp_oauth_request');
    deleteCookie(c, 'mcp_oauth_request', { path: '/mcp' });

    if (!requestCookie) {
      return c.json(
        { error: 'invalid_request', error_description: 'Authorize request expired' },
        400
      );
    }

    const authorizeRequest = await decodeAuthorizeRequest(requestCookie);

    if (!code || !state || state !== authorizeRequest.state) {
      return c.redirect(withError(authorizeRequest.redirectUri, authorizeRequest.state), 302);
    }

    try {
      const { cognitoClientId } = await decodeClientId(authorizeRequest.clientId);

      const tokens = await exchangeCodeForTokensForClient({
        clientId: cognitoClientId,
        code,
        redirectUri: `${config.BACKEND_URL}/mcp/callback`,
      });
      const idTokenPayload = await verifyCognitoIdTokenForClient(tokens.id_token, cognitoClientId);

      if (idTokenPayload.nonce !== authorizeRequest.nonce) {
        return c.redirect(withError(authorizeRequest.redirectUri, authorizeRequest.state), 302);
      }

      const mcpAuthCode = await encodeAuthCode({
        userId: idTokenPayload.sub,
        clientId: authorizeRequest.clientId,
        codeChallenge: authorizeRequest.codeChallenge,
      });

      const redirectTo = new URL(authorizeRequest.redirectUri);
      redirectTo.searchParams.set('code', mcpAuthCode);
      redirectTo.searchParams.set('state', authorizeRequest.state);

      return c.redirect(redirectTo.toString(), 302);
    } catch (error) {
      logger.error('MCP OAuth callback failed:', error);
      return c.redirect(withError(authorizeRequest.redirectUri, authorizeRequest.state), 302);
    }
  });
}
