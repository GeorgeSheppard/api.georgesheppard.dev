/**
 * OpenAPI route definition for Get Recipes endpoint
 */
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { GetRecipesResponseSchema } from './get-recipes.js';

/**
 * OpenAPI route definition for GET /kitchencalm/recipes
 *
 * This endpoint requires JWT authentication and returns all recipes
 * belonging to the authenticated user.
 */
export const getRecipesRoute = createRoute({
  method: 'get',
  path: '/kitchencalm/recipes',
  tags: ['kitchencalm', 'recipes'],
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    headers: z.object({
      authorization: z.string().describe('Bearer token with JWT'),
    }),
  },
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
