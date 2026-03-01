import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getMealPlanForUser } from '@core/dynamodb/utilities.js';
import { MealPlanSchema } from '../../schemas.js';
import { IMealPlan } from '@core/types/meal-plan.js';

export const GetMealPlanResponseSchema = MealPlanSchema;

export type GetMealPlanResponse = z.infer<typeof GetMealPlanResponseSchema>;

function getDayStartTimestamp(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function ensureNextTwoWeeks(mealPlan: IMealPlan): IMealPlan {
  const today = new Date();
  const todayTimestamp = getDayStartTimestamp(today);

  const planMap = new Map<number, IMealPlan[0]>();

  // Add existing entries
  for (const entry of mealPlan) {
    planMap.set(entry.date, entry);
  }

  // Generate empty entries for missing days in the next 2 weeks
  for (let i = 0; i < 14; i++) {
    const date = todayTimestamp + i * 24 * 60 * 60 * 1000;
    if (!planMap.has(date)) {
      planMap.set(date, { date, plan: [] });
    }
  }

  // Return sorted array
  return Array.from(planMap.values()).sort((a, b) => a.date - b.date);
}

export async function getMealPlan(c: ContextWithUserId): Promise<GetMealPlanResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    const mealPlan = await getMealPlanForUser(dynamoClient.client, userId);

    // Filter out entries older than today
    const today = new Date();
    const todayTimestamp = getDayStartTimestamp(today);

    const filteredPlan = mealPlan.filter((entry) => entry.date >= todayTimestamp);

    // Ensure we have entries for the next 2 weeks
    const completePlan = ensureNextTwoWeeks(filteredPlan);

    return completePlan;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch meal plan for user ${userId}`, error);
    throw new Error(`Failed to fetch meal plan: ${message}`);
  }
}
