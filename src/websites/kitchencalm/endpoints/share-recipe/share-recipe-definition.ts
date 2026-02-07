import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { ShareRecipeRequestSchema, ShareRecipeResponseSchema } from './share-recipe.js';

export const shareRecipeRoute = createRoute({
  method: 'post',
  path: '/kitchencalm/recipes/share',
  tags: ['kitchencalm', 'recipes'],
  description: 'Create a shareable public link for a recipe',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    headers: z.object({
      authorization: z.string().describe('Bearer token with JWT'),
    }),
    body: {
      content: {
        'application/json': {
          schema: ShareRecipeRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ShareRecipeResponseSchema,
        },
      },
      description: 'Recipe shared successfully',
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
