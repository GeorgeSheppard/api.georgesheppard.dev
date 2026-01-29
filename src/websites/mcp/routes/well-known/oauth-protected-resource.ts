import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { ROUTES } from '../paths.js';
import { config } from '@config/index.js';

const ProtectedResourceMetadataSchema = z.object({
  resource: z.string().url(),
  authorization_servers: z.array(z.string().url()),
  scopes_supported: z.array(z.string()),
});

const ErrorSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.OAUTH_PROTECTED_RESOURCE,
  tags: ['mcp'],
  request: {},
  responses: {
    200: {
      content: { 'application/json': { schema: ProtectedResourceMetadataSchema } },
      description: 'Protected Resource Metadata for OAuth discovery',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Internal server error',
    },
  },
});

export function registerOAuthProtectedResourceRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    try {
      const fullPoolId = `${config.AWS_COGNITO_REGION}_${config.AWS_COGNITO_USER_POOL_ID}`;
      const authorizationServer = `https://cognito-idp.${config.AWS_COGNITO_REGION}.amazonaws.com/${fullPoolId}`;

      return c.json(
        {
          resource: config.MCP_SERVER_BASE_URL,
          authorization_servers: [authorizationServer],
          scopes_supported: ['mcp:tools', 'mcp:resources'],
        },
        200
      );
    } catch (error) {
      console.error('Error retrieving OAuth protected resource metadata:', error);
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to retrieve metadata',
        },
        500
      );
    }
  });
}
