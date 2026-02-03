import { AsyncLocalStorage } from 'async_hooks';
import { Context } from 'hono';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { OpenAPIHono } from '@hono/zod-openapi';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.js';
import { ContextWithUserId } from '../types/context.js';

/**
 * AsyncLocalStorage allows us to store the Hono context
 * so that MCP tool handlers can access it.
 */
export const honoContextStorage = new AsyncLocalStorage<Context>();

// MCP Server setup - stores tool definitions for documentation
// The actual HTTP endpoints are exposed directly via routes
export const MCP_SERVER_NAME = 'api.georgesheppard.dev';
export const MCP_SERVER_VERSION = '1.0.0';

export interface McpTool<TInput = unknown> {
  name: string;
  description: string;
  handler: (c: ContextWithUserId, input?: TInput) => Promise<Record<string, unknown>>;
  inputSchema?: z.ZodSchema;
  outputSchema?: z.ZodSchema;
}

/**
 * Helper function to create a typed MCP tool with automatic validation
 * This eliminates the need to manually cast or validate input in handlers
 */
export function createMcpTool<TInput>(
  name: string,
  description: string,
  schema: z.ZodSchema<TInput>,
  handler: (c: ContextWithUserId, input: TInput) => Promise<Record<string, unknown>>,
  outputSchema?: z.ZodSchema
): McpTool<unknown> {
  return {
    name,
    description,
    inputSchema: schema,
    outputSchema,
    handler: async (c: ContextWithUserId, input?: unknown) => {
      const validated = schema.parse(input);
      return handler(c, validated);
    },
  };
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
        ...(tool.inputSchema && { inputSchema: tool.inputSchema }),
        ...(tool.outputSchema && { outputSchema: tool.outputSchema }),
      },
      async (input) => {
        const c = honoContextStorage.getStore();
        if (!c) throw new Error('Hono context not available');

        const result = await tool.handler(c, input as any);
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
