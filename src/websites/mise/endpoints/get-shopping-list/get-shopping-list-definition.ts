import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { ShoppingListResponseSchema } from './get-shopping-list.js';

export const getShoppingListRoute = createRoute({
  method: 'get',
  path: '/mise/shopping-list',
  tags: ['mise', 'shopping-list'],
  description:
    'Get aggregated shopping list from recipes in the meal plan, optionally filtered by date range',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    query: z.preprocess(
      (obj: any) => {
        // Handle dates[]=val notation by renaming it to dates
        if (obj && typeof obj === 'object' && obj['dates[]'] && !obj.dates) {
          return {
            ...obj,
            dates: obj['dates[]'],
          };
        }
        return obj;
      },
      z.object({
        dates: z
          .union([z.string().transform((val) => [val]), z.array(z.string())])
          .transform((val) => val?.map((v) => Number(v)))
          .optional()
          .describe('Array of Unix timestamps (milliseconds) to include in shopping list'),
      })
    ),
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
