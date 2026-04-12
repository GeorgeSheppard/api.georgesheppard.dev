import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { ChatRequestSchema, ChatResponseSchema } from './chat.js';

export const chatRoute = createRoute({
  method: 'post',
  path: '/kitchencalm/chat',
  tags: ['kitchencalm', 'chat'],
  description:
    'Send a message to the KitchenCalm AI cooking assistant. Supports web search for finding recipes.',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ChatResponseSchema,
        },
      },
      description: 'AI response returned',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Unauthorized',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Internal server error',
    },
  },
});
