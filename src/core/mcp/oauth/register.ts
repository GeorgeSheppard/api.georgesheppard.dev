import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { createCognitoAppClientForMcp } from './cognito-management.js';
import { encodeClientId } from './client-credentials.js';

const RegisterRequestSchema = z.object({
  client_name: z.string().optional(),
  redirect_uris: z.array(z.string().url()).min(1),
});

export function registerMcpOauthRegisterRoute(app: OpenAPIHono) {
  app.post('/mcp/register', async (c) => {
    const parsed = RegisterRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'invalid_client_metadata' }, 400);
    }

    const { client_name, redirect_uris } = parsed.data;

    const cognitoClient = await createCognitoAppClientForMcp(client_name ?? 'mcp-client');

    const clientId = await encodeClientId({
      cognitoClientId: cognitoClient.clientId,
      redirectUris: redirect_uris,
    });

    return c.json(
      {
        client_id: clientId,
        client_name,
        redirect_uris,
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
      201
    );
  });
}
