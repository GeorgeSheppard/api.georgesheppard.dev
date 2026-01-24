import { z } from '@hono/zod-openapi';
import { IComponentItem, IMealPlan } from '../types/index.js';

export const componentItemSchema: z.ZodType<IComponentItem> = z
  .object({
    componentId: z.string().uuid().openapi({
      description: 'Unique component ID',
    }),
    servings: z.number().openapi({
      example: 2,
      description: 'Number of servings',
    }),
  })
  .openapi('ComponentItem');

export const mealPlanSchema = z
  .record(z.string(), z.record(z.string(), z.array(componentItemSchema)))
  .openapi('MealPlan', {
    description: 'Meal plan organized by date and recipe UUID',
    example: {
      '2024-01-15': {
        'recipe-uuid-1': [
          {
            componentId: 'component-uuid-1',
            servings: 2,
          },
        ],
      },
    },
  }) as z.ZodType<IMealPlan>;
