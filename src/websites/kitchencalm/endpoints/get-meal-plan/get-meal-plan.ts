import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getMealPlanForUser } from '@core/dynamodb/utilities.js';
import { MealPlanDaySchema } from '../../schemas.js';

export const MealPlanEntryItemSchema = z.object({
  date: z.string().describe('Date string in format "DayName - DD/MM/YYYY"'),
  plan: MealPlanDaySchema,
});

export const GetMealPlanResponseSchema = z.array(MealPlanEntryItemSchema);

export type GetMealPlanResponse = z.infer<typeof GetMealPlanResponseSchema>;

function parseDateFromString(dateString: string): Date {
  // Format: "DayName - DD/MM/YYYY"
  const parts = dateString.split(' - ');
  if (parts.length !== 2) {
    return new Date(0); // Fallback for invalid format
  }
  const [day, month, year] = parts[1].split('/').map(Number);
  return new Date(year, month - 1, day);
}

export async function getMealPlan(c: ContextWithUserId): Promise<GetMealPlanResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    const mealPlan = await getMealPlanForUser(dynamoClient.client, userId);

    // Convert record to array and sort by date
    const entries = Object.entries(mealPlan)
      .map(([date, plan]) => ({
        date,
        plan,
      }))
      .sort(
        (a, b) => parseDateFromString(a.date).getTime() - parseDateFromString(b.date).getTime()
      );

    return entries;
  } catch (error) {
    console.error('Failed to fetch meal plan for user', userId, error);
    throw error;
  }
}
