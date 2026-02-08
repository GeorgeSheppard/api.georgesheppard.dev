import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getAllRecipesForUser, getMealPlanForUser } from '@core/dynamodb/utilities.js';
import { createShoppingListData, createShoppingList } from '@core/utilities/shopping-list.js';
import { categoriseIngredients } from '@core/utils/ingredient-categoriser.js';

export const ShoppingListResponseSchema = z.string();

export const GetShoppingListMcpSchema = z.object({
  content: z.string().describe('Formatted shopping list'),
});

export const GetShoppingListRequestSchema = z.object({
  startDate: z.string().optional().describe('Start date (format: DayName - DD/MM/YYYY)'),
  endDate: z.string().optional().describe('End date (format: DayName - DD/MM/YYYY)'),
});

export type GetShoppingListResponse = z.infer<typeof ShoppingListResponseSchema>;

export type GetShoppingListMcpResponse = z.infer<typeof GetShoppingListMcpSchema>;

export async function getShoppingList(
  c: ContextWithUserId,
  input?: unknown
): Promise<GetShoppingListResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  const dateRange =
    input && typeof input === 'object' && ('startDate' in input || 'endDate' in input)
      ? (input as { startDate?: string; endDate?: string })
      : undefined;

  try {
    const [recipes, mealPlan] = await Promise.all([
      getAllRecipesForUser(dynamoClient.client, userId),
      getMealPlanForUser(dynamoClient.client, userId),
    ]);

    let selectedDates: Set<string> | undefined;
    if (dateRange?.startDate || dateRange?.endDate) {
      selectedDates = new Set<string>();
      for (const date of Object.keys(mealPlan)) {
        if (dateRange.startDate && date < dateRange.startDate) continue;
        if (dateRange.endDate && date > dateRange.endDate) continue;
        selectedDates.add(date);
      }
    }

    const quantityAndMeals = createShoppingListData(recipes, mealPlan, selectedDates);
    const ingredientNames = Object.keys(quantityAndMeals);

    let categories: Record<string, string> | undefined;
    if (ingredientNames.length > 0) {
      categories = await categoriseIngredients(ingredientNames);
    }

    return createShoppingList(quantityAndMeals, { includeMeals: false, categories });
  } catch (error) {
    console.error('Failed to fetch shopping list for user', userId, error);
    throw error;
  }
}

export async function getShoppingListMcp(
  c: ContextWithUserId,
  input: { startDate?: string; endDate?: string }
): Promise<GetShoppingListMcpResponse> {
  const content = await getShoppingList(c, input);
  return { content };
}
