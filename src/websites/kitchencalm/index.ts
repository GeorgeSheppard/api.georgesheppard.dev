import { OpenAPIHono } from '@hono/zod-openapi';
import { McpTool } from '@core/mcp/routes/sse.js';
import { helloProtected } from './endpoints/hello-protected/hello-protected.js';
import { HelloProtectedResponseSchema } from './endpoints/hello-protected/hello-protected-definition.js';

/**
 * All MCP tools exposed by the KitchenCalm website
 */
export const tools: McpTool[] = [
  {
    name: 'hello_protected',
    description: 'Get a protected hello message with user ID',
    handler: helloProtected,
    outputSchema: HelloProtectedResponseSchema,
  },
];

/**
 * Register all kitchencalm routes with the application
 */
export function registerRoutes(app: OpenAPIHono) {
  // Website-specific HTTP routes would go here
  // MCP tools are registered globally in server.ts
}
