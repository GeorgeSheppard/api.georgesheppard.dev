import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { GetSharedRecipeResponseSchema } from './get-shared-recipe.js';

export const getSharedRecipeRoute = createRoute({
  method: 'get',
  path: '/kitchencalm/recipes/shared/:shareId',
  tags: ['kitchencalm', 'recipes'],
  description: 'Get a publicly shared recipe by share ID',
  request: {
    params: z.object({
      shareId: z.string().uuid().describe('Share ID'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetSharedRecipeResponseSchema,
        },
      },
      description: 'Shared recipe retrieved successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().describe('Error message'),
          }),
        },
      },
      description: 'Shared recipe not found',
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
