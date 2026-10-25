import { OpenAPIHono } from '@hono/zod-openapi';
import { registerMcpOauthMetadataRoute } from './metadata.js';
import { registerMcpOauthRegisterRoute } from './register.js';
import { registerMcpOauthAuthorizeRoute } from './authorize.js';
import { registerMcpOauthCallbackRoute } from './callback.js';
import { registerMcpOauthTokenRoute } from './token.js';

export function registerMcpOauthRoutes(app: OpenAPIHono) {
  registerMcpOauthMetadataRoute(app);
  registerMcpOauthRegisterRoute(app);
  registerMcpOauthAuthorizeRoute(app);
  registerMcpOauthCallbackRoute(app);
  registerMcpOauthTokenRoute(app);
}
