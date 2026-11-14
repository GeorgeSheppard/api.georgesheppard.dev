import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { DeleteServerParamsSchema, DeleteServerResponseSchema } from './delete-server.js';

export const deleteServerRoute = createRoute({
  method: 'delete',
  path: '/engine/servers/{id}',
  tags: ['engine'],
  description: 'Delete a running Engine server',
  request: { params: DeleteServerParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteServerResponseSchema } },
      description: 'Server deleted',
    },
    404: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Server not found or already deleted',
    },
  },
});
