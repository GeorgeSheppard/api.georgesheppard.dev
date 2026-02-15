import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { GetRecipesResponseSchema } from './get-recipes.js';

export const getRecipesRoute = createRoute({
  method: 'get',
  path: '/kitchencalm/recipes',
  tags: ['kitchencalm', 'recipes'],
  description: 'Get all recipes for the authenticated user',
  security: [{ Bearer: [] }],
  middleware: [jwtAuthMiddleware],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetRecipesResponseSchema,
        },
      },
      description: 'Recipes retrieved successfully',
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
