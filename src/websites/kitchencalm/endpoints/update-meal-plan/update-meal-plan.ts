import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { putMealPlanForUser } from '@core/dynamodb/utilities.js';
import { MealPlanDaySchema } from '../../schemas.js';

export const MealPlanEntryItemSchema = z.object({
  date: z.string().describe('Date string in format "DayName - DD/MM/YYYY"'),
  plan: MealPlanDaySchema,
});

export const UpdateMealPlanRequestSchema = z.array(MealPlanEntryItemSchema);

export type UpdateMealPlanRequest = z.infer<typeof UpdateMealPlanRequestSchema>;

export const UpdateMealPlanResponseSchema = z.object({
  success: z.boolean().describe('Whether update was successful'),
});

export type UpdateMealPlanResponse = z.infer<typeof UpdateMealPlanResponseSchema>;

export async function updateMealPlan(
  c: ContextWithUserId,
  mealPlanArray: UpdateMealPlanRequest
): Promise<UpdateMealPlanResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    // Convert array back to record object for storage
    const mealPlan: Record<string, (typeof mealPlanArray)[0]['plan']> = {};
    for (const entry of mealPlanArray) {
      mealPlan[entry.date] = entry.plan;
    }

    await putMealPlanForUser(dynamoClient.client, userId, mealPlan as any);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to update meal plan for user', userId, error);
    throw error;
  }
}
