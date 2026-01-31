import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { OpenAPIHono } from '@hono/zod-openapi';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.js';
import { honoContextStorage } from '../context.js';
import { handleProtectedHelloTool } from './tool-implementations.js';
import { ProtectedHelloResponseSchema } from "./schemas.js";

export function registerMcpSseRoute(app: OpenAPIHono) {
  // Create MCP server once when route is registered
  // This allows proper tool discovery via list_tools
  const mcpServer = new McpServer({
    name: 'api.georgesheppard.dev',
    version: '1.0.0',
  });

  // Register tools once - they will retrieve Hono context via AsyncLocalStorage
  mcpServer.registerTool(
    'hello_protected',
    {
      description: 'Get a protected hello message with user ID',
      outputSchema: ProtectedHelloResponseSchema
    },
    async () => {
      const c = honoContextStorage.getStore();
      if (!c) throw new Error('Hono context not available');

      console.log('context', c.get('databaseClient'))

      const result = await handleProtectedHelloTool(c);
      return {
        structuredContent: result,
        content: [],
      };
    }
  );

  app.all('/mcp', jwtAuthMiddleware, async (c) => {
    const transport = new StreamableHTTPTransport();
    await mcpServer.connect(transport);
    // Run the request handler with the Hono context stored
    return honoContextStorage.run(c, () => transport.handleRequest(c));
  });
}
