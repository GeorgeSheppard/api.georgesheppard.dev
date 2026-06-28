import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { DeleteRecipeResponseSchema } from './delete-recipe.js';

export const deleteRecipeRoute = createRoute({
  method: 'delete',
  path: '/mise/recipes/{uuid}',
  tags: ['mise', 'recipes'],
  description: 'Delete a recipe for the authenticated user',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    params: z.object({
      uuid: z.string().uuid().describe('Recipe UUID to delete'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DeleteRecipeResponseSchema,
        },
      },
      description: 'Recipe deleted successfully',
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
