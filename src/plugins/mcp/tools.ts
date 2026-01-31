import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const MCP_TOOLS: Tool[] = [
  {
    name: 'hello_public',
    description: 'Get a public hello message from the MCP server',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'hello_protected',
    description: 'Get a protected hello message that requires JWT authentication',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];
