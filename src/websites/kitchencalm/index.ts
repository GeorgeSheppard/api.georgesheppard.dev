import { OpenAPIHono } from '@hono/zod-openapi';
import { McpTool } from '@core/mcp/sse.js';
import { ContextWithUserId } from '@core/types/context.js';
import {
  helloProtected,
  HelloProtectedResponseSchema,
} from './endpoints/hello-protected/hello-protected.js';
import { authToken } from './endpoints/auth-token/auth-token.js';
import { authTokenRoute } from './endpoints/auth-token/auth-token-definition.js';
import { getRecipes } from './endpoints/get-recipes/get-recipes.js';
import { getRecipesRoute } from './endpoints/get-recipes/get-recipes-definition.js';

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
  {
    name: 'get_recipes',
    description: 'Get all recipes for the authenticated user',
    handler: getRecipes,
  },
];

/**
 * Register all kitchencalm routes with the application
 */
export function registerRoutes(app: OpenAPIHono) {
  app.openapi(authTokenRoute, async (c) => {
    const { userId } = c.req.valid('json');
    const result = await authToken(c, userId);
    return c.json(result, 200);
  });

  app.openapi(getRecipesRoute, async (c) => {
    const result = await getRecipes(c as ContextWithUserId);
    return c.json(result, 200);
  });
}
