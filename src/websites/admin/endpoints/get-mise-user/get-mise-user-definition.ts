import { createRoute, z } from '@hono/zod-openapi';
import { adminAuthMiddleware } from '@core/middleware/admin-auth.js';
import { adminErrorResponses } from '../../schemas.js';
import { GetMiseUserResponseSchema } from './get-mise-user.js';

export const getMiseUserRoute = createRoute({
  method: 'get',
  path: '/admin/mise/users/{userId}',
  tags: ['admin'],
  description: 'Get every recipe and the meal plan owned by a Mise user',
  middleware: [adminAuthMiddleware],
  request: {
    params: z.object({
      userId: z.string().min(1).describe('Cognito user ID (sub)'),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: GetMiseUserResponseSchema } },
      description: 'User data retrieved successfully',
    },
    ...adminErrorResponses,
  },
});
