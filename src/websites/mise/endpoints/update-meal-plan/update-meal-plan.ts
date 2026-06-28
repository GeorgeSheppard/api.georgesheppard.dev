import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { putMealPlanForUser } from '@core/dynamodb/utilities.js';
import { MealPlanSchema } from '../../schemas.js';
import { IMealPlan } from '@core/types/meal-plan.js';

export const UpdateMealPlanRequestSchema = MealPlanSchema;

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
    // Sort by date before storing
    const sortedMealPlan: IMealPlan = mealPlan.sort((a, b) => a.date - b.date);

    await putMealPlanForUser(dynamoClient.client, userId, sortedMealPlan);

    return {
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to update meal plan for user ${userId}`, error);
    throw new Error(`Failed to update meal plan: ${message}`);
  }
}
