import { deleteCookie } from 'hono/cookie';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { buildLogoutUrl } from '@core/utils/cognito-oauth.js';
import { config } from '@config/index.js';

const LogoutResponseSchema = z.object({
  success: z.literal(true),
  cognitoLogoutUrl: z.string(),
});

const route = createRoute({
  method: 'post',
  path: '/auth/logout',
  tags: ['auth'],
  responses: {
    200: {
      content: { 'application/json': { schema: LogoutResponseSchema } },
      description: 'Logged out',
    },
  },
});

function frontendUrl(): string {
  return config.NODE_ENV === 'production' ? config.FRONTEND_URL_PROD : config.FRONTEND_URL_DEV;
}

export function logout(): { success: true; cognitoLogoutUrl: string } {
  return {
    success: true,
    cognitoLogoutUrl: buildLogoutUrl(frontendUrl()),
  };
}

export function registerLogoutRoute(app: OpenAPIHono) {
  app.openapi(route, (c) => {
    deleteCookie(c, 'session', { path: '/' });
    return c.json(logout(), 200);
  });
}
