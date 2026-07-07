import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { GetActiveShoppingListResponseSchema } from './get-active-shopping-list.js';

export const getActiveShoppingListRoute = createRoute({
  method: 'get',
  path: '/mise/shopping-list/active',
  tags: ['mise', 'shopping-list'],
  description: 'Get the active (previously generated) shopping list for the authenticated user',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetActiveShoppingListResponseSchema,
        },
      },
      description: 'Active shopping list retrieved successfully',
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
