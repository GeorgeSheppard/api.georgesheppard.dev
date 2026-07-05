import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { UpdateRecipeRequestSchema, UpdateRecipeResponseSchema } from './update-recipe.js';

export const updateRecipeRoute = createRoute({
  method: 'post',
  path: '/mise/recipes',
  tags: ['mise', 'recipes'],
  description: 'Create or update a recipe for the authenticated user',
  security: [{ Bearer: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateRecipeRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateRecipeResponseSchema,
        },
      },
      description: 'Recipe created or updated successfully',
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
