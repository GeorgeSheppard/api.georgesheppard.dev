import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getMealPlanForUser } from '@core/dynamodb/utilities.js';
import { MealPlanDaySchema } from '../../schemas.js';

export const GetMealPlanResponseSchema = z.record(z.string(), MealPlanDaySchema);

export type GetMealPlanResponse = z.infer<typeof GetMealPlanResponseSchema>;

export async function getMealPlan(c: ContextWithUserId): Promise<GetMealPlanResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    const mealPlan = await getMealPlanForUser(dynamoClient.client, userId);

    return mealPlan as GetMealPlanResponse;
  } catch (error) {
    console.error('Failed to fetch meal plan for user', userId, error);
    throw error;
  }
}
