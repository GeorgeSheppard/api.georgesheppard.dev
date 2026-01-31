import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { OpenAPIHono } from '@hono/zod-openapi';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.js';
import { honoContextStorage } from '../context.js';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from '../server.js';

export interface McpTool {
  name: string;
  description: string;
  handler: (c: any) => Promise<any>;
  outputSchema?: any;
}

/**
 * Register an SSE-based MCP endpoint with support for custom tools
 * @param app Hono app instance
 * @param tools Array of tool definitions with handlers
 */
export function registerMcpSseRoute(app: OpenAPIHono, tools: McpTool[]) {
  // Create MCP server once when route is registered
  // This allows proper tool discovery via list_tools
  const mcpServer = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });

  // Register all provided tools
  for (const tool of tools) {
    mcpServer.registerTool(
      tool.name,
      {
        description: tool.description,
        ...(tool.outputSchema && { outputSchema: tool.outputSchema }),
      },
      async () => {
        const c = honoContextStorage.getStore();
        if (!c) throw new Error('Hono context not available');

        const result = await tool.handler(c);
        return {
          structuredContent: result,
          content: [],
        };
      }
    );
  }

  app.all('/mcp', jwtAuthMiddleware, async (c) => {
    const transport = new StreamableHTTPTransport();
    await mcpServer.connect(transport);
    // Run the request handler with the Hono context stored
    return honoContextStorage.run(c, () => transport.handleRequest(c));
  });
}
