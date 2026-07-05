import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { ChatRequestSchema, ChatResponseSchema } from './chat.js';

export const chatRoute = createRoute({
  method: 'post',
  path: '/mise/chat',
  tags: ['mise', 'chat'],
  description: 'Send a message to Chef, the Mise cooking assistant',
  security: [{ Bearer: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ChatResponseSchema,
        },
      },
      description: 'Assistant reply',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().describe('Error message'),
          }),
        },
      },
      description: 'Unauthorized - invalid or missing JWT token',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().describe('Error message'),
          }),
        },
      },
      description: 'Internal server error',
    },
  },
});
