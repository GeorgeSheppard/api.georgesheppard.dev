import { OpenAPIHono } from '@hono/zod-openapi';
import { config } from '@config/index.js';

export function registerMcpOauthMetadataRoute(app: OpenAPIHono) {
  app.get('/.well-known/oauth-authorization-server', (c) => {
    const issuer = config.BACKEND_URL;
    return c.json({
      issuer,
      authorization_endpoint: `${issuer}/mcp/authorize`,
      token_endpoint: `${issuer}/mcp/token`,
      registration_endpoint: `${issuer}/mcp/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  });
}
