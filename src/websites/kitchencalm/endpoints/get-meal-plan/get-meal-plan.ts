import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getMealPlanForUser } from '@core/dynamodb/utilities.js';
import { MealPlanDaySchema } from '../../schemas.js';
import { IMealPlan } from '@core/types/meal-plan.js';

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

function formatDateToString(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${dayName} - ${day}/${month}/${year}`;
}

function isDateStale(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Consider dates more than 7 days in the past as stale
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return date < sevenDaysAgo;
}

function updateMealPlanDatesToCurrentWindow(mealPlan: IMealPlan): IMealPlan {
  if (Object.keys(mealPlan).length === 0) {
    return mealPlan;
  }

  const dates = Object.keys(mealPlan).map((dateStr) => ({
    dateStr,
    date: parseDateFromString(dateStr),
  }));

  // Find the earliest and latest dates
  const earliestDate = dates.reduce((min, current) =>
    current.date < min.date ? current : min
  ).date;

  const latestDate = dates.reduce((max, current) => (current.date > max.date ? current : max)).date;

  // If earliest date is not stale, return original meal plan
  if (!isDateStale(earliestDate)) {
    return mealPlan;
  }

  // Calculate shifts needed to satisfy both constraints:
  // 1. Earliest date becomes 7 days ago (1 week backward)
  // 2. Latest date becomes 14 days from now (2 weeks forward)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const twoWeeksFromNow = new Date(today);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  const shift1Days = Math.floor(
    (sevenDaysAgo.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const shift2Days = Math.floor(
    (twoWeeksFromNow.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Use the larger shift to satisfy both constraints
  const daysDiff = Math.max(shift1Days, shift2Days);

  // Create updated meal plan with shifted dates
  const updatedMealPlan: IMealPlan = {};
  for (const { dateStr, date } of dates) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + daysDiff);
    const newDateStr = formatDateToString(newDate);
    updatedMealPlan[newDateStr] = mealPlan[dateStr];
  }

  return updatedMealPlan;
}

export async function getMealPlan(c: ContextWithUserId): Promise<GetMealPlanResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    const mealPlan = await getMealPlanForUser(dynamoClient.client, userId);

    // Update meal plan dates if stale (for display only)
    const displayMealPlan = updateMealPlanDatesToCurrentWindow(mealPlan);

    // Convert record to array and sort by date
    const entries = Object.entries(displayMealPlan)
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
