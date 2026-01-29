import { OpenAPIHono } from '@hono/zod-openapi';
import { registerOAuthProtectedResourceRoute } from './well-known/oauth-protected-resource.js';
import { registerOpenidConfigurationRoute } from './well-known/openid-configuration.js';
import { registerOAuthAuthorizationServerRoute } from './well-known/oauth-authorization-server.js';
import { registerOAuthCallbackRoute } from './oauth-callback.js';
import { registerMcpHelloRoute } from './hello.js';

export function registerMcpRoutes(app: OpenAPIHono) {
  registerOAuthProtectedResourceRoute(app);
  registerOpenidConfigurationRoute(app);
  registerOAuthAuthorizationServerRoute(app);
  registerOAuthCallbackRoute(app);
  registerMcpHelloRoute(app);
}
