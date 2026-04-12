import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { IsChatAvailableResponseSchema } from './is-chat-available.js';

export const isChatAvailableRoute = createRoute({
  method: 'get',
  path: '/kitchencalm/is-chat-available',
  tags: ['kitchencalm', 'chat'],
  description:
    'Check whether the chat feature is available for the authenticated user. Returns a reason when unavailable.',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: IsChatAvailableResponseSchema,
        },
      },
      description: 'Chat availability status',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Unauthorized',
    },
  },
});
