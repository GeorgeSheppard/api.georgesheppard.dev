import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { signJwt } from '@core/utils/jwt.js';
import { decodeAuthCode } from './client-credentials.js';
import { verifyPkce } from './pkce.js';

const TokenRequestSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string(),
  client_id: z.string(),
  code_verifier: z.string(),
});

export function registerMcpOauthTokenRoute(app: OpenAPIHono) {
  app.post('/mcp/token', async (c) => {
    const body = await c.req.parseBody();
    const parsed = TokenRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid_request' }, 400);
    }

    const { code, client_id, code_verifier } = parsed.data;

    let authCode;
    try {
      authCode = await decodeAuthCode(code);
    } catch {
      return c.json({ error: 'invalid_grant' }, 400);
    }

    if (authCode.clientId !== client_id) {
      return c.json({ error: 'invalid_grant' }, 400);
    }

    if (!verifyPkce(code_verifier, authCode.codeChallenge)) {
      return c.json({ error: 'invalid_grant' }, 400);
    }

    const accessToken = await signJwt(authCode.userId);

    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
    });
  });
}
