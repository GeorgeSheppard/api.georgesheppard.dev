import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { jwtAuthMiddleware } from '@core/middleware/jwt-auth.js';
import { UpdateMealPlanRequestSchema, UpdateMealPlanResponseSchema } from './update-meal-plan.js';

export const updateMealPlanRoute = createRoute({
  method: 'put',
  path: '/kitchencalm/meal-plan',
  tags: ['kitchencalm', 'meal-plan'],
  description: 'Update the meal plan for the authenticated user',
  security: [{ bearerAuth: [] }],
  middleware: [jwtAuthMiddleware],
  request: {
    headers: z.object({
      authorization: z.string().describe('Bearer token with JWT'),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateMealPlanRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateMealPlanResponseSchema,
        },
      },
      description: 'Meal plan updated successfully',
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
