import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { GetMealPlanResponseSchema } from './get-meal-plan.js';

export const getMealPlanRoute = createRoute({
  method: 'get',
  path: '/kitchencalm/meal-plan',
  tags: ['kitchencalm', 'meal-plan'],
  description: 'Get the meal plan for the authenticated user',
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
          schema: GetMealPlanResponseSchema,
        },
      },
      description: 'Meal plan retrieved successfully',
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
