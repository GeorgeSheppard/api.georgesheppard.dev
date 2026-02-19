import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { ShoppingListResponseSchema } from './get-shopping-list.js';

export const getShoppingListRoute = createRoute({
  method: 'get',
  path: '/kitchencalm/shopping-list',
  tags: ['kitchencalm', 'shopping-list'],
  description:
    'Get aggregated shopping list from recipes in the meal plan, optionally filtered by date range',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    query: z.object({
      startDate: z
        .string()
        .optional()
        .describe('Filter shopping list from this date (format: DayName - DD/MM/YYYY)'),
      endDate: z
        .string()
        .optional()
        .describe('Filter shopping list until this date (format: DayName - DD/MM/YYYY)'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ShoppingListResponseSchema,
        },
      },
      description: 'Shopping list retrieved successfully',
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
