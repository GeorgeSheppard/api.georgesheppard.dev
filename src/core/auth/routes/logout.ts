import { deleteCookie } from 'hono/cookie';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { buildLogoutUrl } from '@core/utils/cognito-oauth.js';
import { resolveRedirectUri } from '../redirect.js';

const LogoutResponseSchema = z.object({
  success: z.literal(true),
  cognitoLogoutUrl: z.string(),
});

const QuerySchema = z.object({
  redirect_uri: z.string().optional(),
});

const route = createRoute({
  method: 'post',
  path: '/auth/logout',
  tags: ['auth'],
  request: { query: QuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: LogoutResponseSchema } },
      description: 'Logged out',
    },
  },
});

export function logout(redirectUri?: string): { success: true; cognitoLogoutUrl: string } {
  return {
    success: true,
    cognitoLogoutUrl: buildLogoutUrl(resolveRedirectUri(redirectUri)),
  };
}

export function registerLogoutRoute(app: OpenAPIHono) {
  app.openapi(route, (c) => {
    deleteCookie(c, 'session', { path: '/' });
    const { redirect_uri } = c.req.valid('query');
    return c.json(logout(redirect_uri), 200);
  });
}
