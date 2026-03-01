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
  const oneWeekAgo = todayTimestamp - 7 * 24 * 60 * 60 * 1000;
  const twoWeeksFromNow = todayTimestamp + 14 * 24 * 60 * 60 * 1000;

  const planMap = new Map<number, IMealPlan[0]>();

  // Add existing entries, but only keep entries from the past week onwards
  for (const entry of mealPlan) {
    if (entry.date >= oneWeekAgo) {
      planMap.set(entry.date, entry);
    }
  }

  // Generate empty entries for missing days in the 1-week past to 2-weeks forward window
  for (let i = -7; i < 14; i++) {
    const date = todayTimestamp + i * 24 * 60 * 60 * 1000;
    if (!planMap.has(date) && date >= oneWeekAgo && date < twoWeeksFromNow) {
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

    // Ensure we have entries for the next 2 weeks from today
    const completePlan = ensureNextTwoWeeks(mealPlan);

    return completePlan;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch meal plan for user ${userId}`, error);
    throw new Error(`Failed to fetch meal plan: ${message}`);
  }
}
