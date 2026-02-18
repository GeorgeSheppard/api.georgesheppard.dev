import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { putMealPlanForUser } from '@core/dynamodb/utilities.js';
import { IMealPlan } from '@core/types/meal-plan.js';
import { MealPlanDaySchema } from '../../schemas.js';

export const UpdateMealPlanRequestSchema = z.record(z.string(), MealPlanDaySchema);

export type UpdateMealPlanRequest = z.infer<typeof UpdateMealPlanRequestSchema>;

export const UpdateMealPlanResponseSchema = z.object({
  success: z.boolean().describe('Whether update was successful'),
});

export type UpdateMealPlanResponse = z.infer<typeof UpdateMealPlanResponseSchema>;

export async function updateMealPlan(
  c: ContextWithUserId,
  mealPlan: UpdateMealPlanRequest
): Promise<UpdateMealPlanResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    await putMealPlanForUser(dynamoClient.client, userId, mealPlan as IMealPlan);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to update meal plan for user', userId, error);
    throw error;
  }
}
