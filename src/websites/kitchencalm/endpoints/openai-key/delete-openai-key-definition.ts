import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { DeleteOpenAIKeyResponseSchema } from './delete-openai-key.js';

export const deleteOpenAIKeyRoute = createRoute({
  method: 'delete',
  path: '/kitchencalm/openai-key',
  tags: ['kitchencalm', 'chat'],
  description: 'Delete the stored OpenAI API key for the authenticated user',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DeleteOpenAIKeyResponseSchema,
        },
      },
      description: 'API key deleted successfully',
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
