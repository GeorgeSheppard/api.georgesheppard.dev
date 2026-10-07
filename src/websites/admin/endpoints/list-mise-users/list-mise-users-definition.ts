import { createRoute } from '@hono/zod-openapi';
import { adminHeadersSchema, adminRouteConfig, unauthorizedResponse } from '../../schemas.js';
import { ListMiseUsersResponseSchema } from './list-mise-users.js';

export const listMiseUsersRoute = createRoute({
  method: 'get',
  path: '/admin/mise/users',
  ...adminRouteConfig,
  description: 'List every Mise user with a summary of the data they own',
  request: { headers: adminHeadersSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: ListMiseUsersResponseSchema } },
      description: 'Users retrieved successfully',
    },
    ...unauthorizedResponse,
  },
});
