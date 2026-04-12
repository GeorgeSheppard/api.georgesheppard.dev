import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { GetOpenAIKeyStatusResponseSchema } from './get-openai-key-status.js';

export const getOpenAIKeyStatusRoute = createRoute({
  method: 'get',
  path: '/kitchencalm/openai-key',
  tags: ['kitchencalm', 'chat'],
  description: 'Check whether the authenticated user has an OpenAI API key stored',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetOpenAIKeyStatusResponseSchema,
        },
      },
      description: 'Key status returned',
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
