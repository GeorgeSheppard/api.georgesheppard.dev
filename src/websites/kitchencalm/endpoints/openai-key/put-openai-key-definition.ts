import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { PutOpenAIKeyRequestSchema, PutOpenAIKeyResponseSchema } from './put-openai-key.js';

export const putOpenAIKeyRoute = createRoute({
  method: 'put',
  path: '/kitchencalm/openai-key',
  tags: ['kitchencalm', 'chat'],
  description: 'Store or replace the OpenAI API key for the authenticated user (encrypted at rest)',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    body: {
      content: {
        'application/json': {
          schema: PutOpenAIKeyRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PutOpenAIKeyResponseSchema,
        },
      },
      description: 'API key stored successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Invalid request body',
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
