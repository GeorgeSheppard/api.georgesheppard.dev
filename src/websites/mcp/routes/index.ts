import { OpenAPIHono } from '@hono/zod-openapi';
import { registerOAuthProtectedResourceRoute } from './well-known/oauth-protected-resource.js';
import { registerMcpHelloRoute } from './hello.js';

export function registerMcpRoutes(app: OpenAPIHono) {
  registerOAuthProtectedResourceRoute(app);
  registerMcpHelloRoute(app);
}
