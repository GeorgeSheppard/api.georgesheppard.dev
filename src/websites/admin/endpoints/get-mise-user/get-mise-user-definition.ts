import { createRoute, z } from '@hono/zod-openapi';
import { adminHeadersSchema, adminRouteConfig, unauthorizedResponse } from '../../schemas.js';
import { GetMiseUserResponseSchema } from './get-mise-user.js';

export const getMiseUserRoute = createRoute({
  method: 'get',
  path: '/admin/mise/users/{userId}',
  ...adminRouteConfig,
  description: 'Get every recipe and the meal plan owned by a Mise user',
  request: {
    headers: adminHeadersSchema,
    params: z.object({
      userId: z.string().min(1).describe('Cognito user ID (sub)'),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: GetMiseUserResponseSchema } },
      description: 'User data retrieved successfully',
    },
    ...unauthorizedResponse,
  },
});
