import { config } from '@config/index.js';
import { MiddlewareHandler } from 'hono';

export function mcpAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const metadataUrl = `${config.MCP_SERVER_BASE_URL}/.well-known/oauth-protected-resource`;
      c.header('WWW-Authenticate', `Bearer realm="mcp", resource_metadata="${metadataUrl}"`);
      return c.json({ error: 'Authorization required' }, 401);
    }

    // Phase 1: No token validation yet, just check presence
    // Phase 2 will add JWT validation or introspection here

    await next();
  };
}
