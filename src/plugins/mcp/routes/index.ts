import { OpenAPIHono } from '@hono/zod-openapi';
import { registerAuthTokenRoute } from './auth-token.js';
import { registerHelloProtectedRoute } from './hello-protected.js';
import { registerMcpSseRoute } from './sse.js';

export function registerMcpRoutes(app: OpenAPIHono) {
  registerAuthTokenRoute(app);
  registerHelloProtectedRoute(app);
  registerMcpSseRoute(app);
}
