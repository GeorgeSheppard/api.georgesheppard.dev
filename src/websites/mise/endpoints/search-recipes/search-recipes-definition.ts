import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { SearchRecipesRequestSchema, SearchRecipesResponseSchema } from './search-recipes.js';

export const searchRecipesRoute = createRoute({
  method: 'get',
  path: '/mise/recipes/search',
  tags: ['mise', 'recipes'],
  description: 'Search recipes by name, description, ingredients, or instructions',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    query: SearchRecipesRequestSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SearchRecipesResponseSchema,
        },
      },
      description: 'Search results retrieved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().describe('Error message'),
          }),
        },
      },
      description: 'Bad request - invalid query parameters',
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
