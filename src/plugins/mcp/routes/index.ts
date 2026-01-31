import { OpenAPIHono } from '@hono/zod-openapi';
import { registerHelloPublicRoute } from './hello-public.js';
import { registerAuthTokenRoute } from './auth-token.js';
import { registerHelloProtectedRoute } from './hello-protected.js';

export function registerMcpRoutes(app: OpenAPIHono) {
  registerHelloPublicRoute(app);
  registerAuthTokenRoute(app);
  registerHelloProtectedRoute(app);
}
