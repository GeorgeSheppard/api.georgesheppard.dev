import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import {
  GenerateShoppingListRequestSchema,
  GenerateShoppingListResponseSchema,
} from './generate-shopping-list.js';

export const generateShoppingListRoute = createRoute({
  method: 'post',
  path: '/mise/shopping-list/generate',
  tags: ['mise', 'shopping-list'],
  description:
    'Generate a shopping list from the meal plan (optionally filtered by dates) and store it as the active shopping list for mobile use',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    body: {
      content: {
        'application/json': {
          schema: GenerateShoppingListRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GenerateShoppingListResponseSchema,
        },
      },
      description: 'Shopping list generated and saved successfully',
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
