import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import {
  deleteRecipe as deleteRecipeFromDynamo,
  getMealPlanForUser,
  putMealPlanForUser,
} from '@core/dynamodb/utilities.js';

export const DeleteRecipeRequestSchema = z.object({
  uuid: z.string().uuid().describe('Recipe UUID to delete'),
});

export type DeleteRecipeRequest = z.infer<typeof DeleteRecipeRequestSchema>;

export const DeleteRecipeResponseSchema = z.object({
  success: z.boolean().describe('Whether delete was successful'),
  uuid: z.string().uuid().describe('UUID of deleted recipe'),
});

export type DeleteRecipeResponse = z.infer<typeof DeleteRecipeResponseSchema>;

export async function deleteRecipe(
  c: ContextWithUserId,
  uuid: string
): Promise<DeleteRecipeResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    await deleteRecipeFromDynamo(dynamoClient.client, userId, uuid);

    const mealPlan = await getMealPlanForUser(dynamoClient.client, userId);
    const updatedMealPlan = mealPlan
      .map((day) => ({ ...day, plan: day.plan.filter((entry) => entry.recipeId !== uuid) }))
      .filter((day) => day.plan.length > 0);

    const recipeWasInMealPlan =
      updatedMealPlan.reduce((sum, day) => sum + day.plan.length, 0) !==
      mealPlan.reduce((sum, day) => sum + day.plan.length, 0);
    if (recipeWasInMealPlan) {
      await putMealPlanForUser(dynamoClient.client, userId, updatedMealPlan);
    }

    return {
      success: true,
      uuid,
    };
  } catch (error) {
    console.error('Failed to delete recipe for user', userId, error);
    throw error;
  }
}
