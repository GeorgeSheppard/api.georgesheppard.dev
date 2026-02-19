import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getAllRecipesForUser, getMealPlanForUser } from '@core/dynamodb/utilities.js';
import { createShoppingListData } from '@websites/kitchencalm/utils/shopping-list.js';
import { categoriseIngredients } from '@websites/kitchencalm/utils/ingredient-categoriser.js';

export const ShoppingListItemSchema = z.object({
  ingredient: z.string().describe('Name of the ingredient'),
  quantities: z
    .array(
      z.object({
        value: z.number().optional().describe('Quantity value'),
        unit: z.string().describe('Unit of measurement'),
      })
    )
    .describe('Array of quantities with units'),
  category: z.string().describe('Shopping category for the ingredient'),
});

export const ShoppingListResponseSchema = z
  .array(ShoppingListItemSchema)
  .describe('Array of shopping list items with ingredient, quantity, and category');

export const GetShoppingListMcpSchema = z.object({
  content: z.string().describe('Formatted shopping list'),
});

export const GetShoppingListRequestSchema = z.object({
  startDate: z.string().optional().describe('Start date (format: DayName - DD/MM/YYYY)'),
  endDate: z.string().optional().describe('End date (format: DayName - DD/MM/YYYY)'),
});

export type ShoppingListItem = z.infer<typeof ShoppingListItemSchema>;

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

    const items: ShoppingListItem[] = Object.entries(quantityAndMeals).map(
      ([ingredient, { quantities }]) => ({
        ingredient,
        quantities: quantities.map((q) => ({
          value: q.value,
          unit: q.unit,
        })),
        category: categories?.[ingredient] ?? 'Other',
      })
    );

    return items.sort((a, b) => a.ingredient.localeCompare(b.ingredient));
  } catch (error) {
    console.error('Failed to fetch shopping list for user', userId, error);
    throw error;
  }
}

export async function getShoppingListMcp(
  c: ContextWithUserId,
  input: { startDate?: string; endDate?: string }
): Promise<GetShoppingListMcpResponse> {
  const items = await getShoppingList(c, input);
  const content = items
    .map(
      (item) =>
        `${item.ingredient} - ${item.quantities.map((q) => `${q.value || ''}${q.unit}`).join(', ')} (${item.category})`
    )
    .join('\n');
  return { content };
}
