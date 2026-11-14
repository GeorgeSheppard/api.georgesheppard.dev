import { createRoute } from '@hono/zod-openapi';
import { ListServersResponseSchema } from './list-servers.js';

export const listServersRoute = createRoute({
  method: 'get',
  path: '/engine/servers',
  tags: ['engine'],
  description: 'List Engine servers (admin view, unauthenticated, restricted by origin)',
  responses: {
    200: {
      content: { 'application/json': { schema: ListServersResponseSchema } },
      description: 'Servers, newest first',
    },
  },
});
