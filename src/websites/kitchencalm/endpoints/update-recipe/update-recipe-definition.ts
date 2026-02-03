import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { UpdateRecipeRequestSchema, UpdateRecipeResponseSchema } from './update-recipe.js';

export const updateRecipeRoute = createRoute({
  method: 'put',
  path: '/kitchencalm/recipes',
  tags: ['kitchencalm', 'recipes'],
  description: 'Create or update a recipe for the authenticated user',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    headers: z.object({
      authorization: z.string().describe('Bearer token with JWT'),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateRecipeRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateRecipeResponseSchema,
        },
      },
      description: 'Recipe updated/created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().describe('Error message'),
          }),
        },
      },
      description: 'Invalid request body',
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
