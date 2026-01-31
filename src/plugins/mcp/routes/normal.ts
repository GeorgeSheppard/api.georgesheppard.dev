import { OpenAPIHono } from '@hono/zod-openapi';
import { handleProtectedHello } from './handlers.js';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.js';

/**
 * Register normal (non-MCP) routes that share handlers with MCP routes
 * This allows the same business logic to be exposed both via MCP and HTTP
 */
export function registerNormalRoutes(app: OpenAPIHono) {
  // Protected route - requires JWT authentication
  app.get('/api/hello-protected', jwtAuthMiddleware, handleProtectedHello);
}
