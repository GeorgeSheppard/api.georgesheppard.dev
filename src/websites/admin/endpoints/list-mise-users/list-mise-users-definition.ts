import { createRoute } from '@hono/zod-openapi';
import { adminAuthMiddleware } from '@core/middleware/admin-auth.js';
import { adminErrorResponses } from '../../schemas.js';
import { ListMiseUsersResponseSchema } from './list-mise-users.js';

export const listMiseUsersRoute = createRoute({
  method: 'get',
  path: '/admin/mise/users',
  tags: ['admin'],
  description: 'List every Mise user with a summary of the data they own',
  middleware: [adminAuthMiddleware],
  responses: {
    200: {
      content: { 'application/json': { schema: ListMiseUsersResponseSchema } },
      description: 'Users retrieved successfully',
    },
    ...adminErrorResponses,
  },
});
