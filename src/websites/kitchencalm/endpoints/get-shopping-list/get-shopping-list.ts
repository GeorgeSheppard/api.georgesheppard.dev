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
  meals: z.array(z.string()).describe('List of meals this ingredient belongs to'),
});

export const ShoppingListResponseSchema = z
  .array(ShoppingListItemSchema)
  .describe('Array of shopping list items with ingredient, quantity, and category');

export const GetShoppingListMcpSchema = z.object({
  content: z.string().describe('Formatted shopping list'),
});

export const GetShoppingListRequestSchema = z.object({
  dates: z.array(z.number()).optional().describe('Array of Unix timestamps (milliseconds)'),
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

  const requestInput =
    input && typeof input === 'object' && 'dates' in input
      ? (input as { dates?: number[] })
      : undefined;

  try {
    const [recipes, mealPlan] = await Promise.all([
      getAllRecipesForUser(dynamoClient.client, userId),
      getMealPlanForUser(dynamoClient.client, userId),
    ]);

    let selectedDates: Set<number> | undefined;
    if (requestInput?.dates && requestInput.dates.length > 0) {
      selectedDates = new Set(requestInput.dates);
    }

    const quantityAndMeals = createShoppingListData(recipes, mealPlan, selectedDates);
    const ingredientNames = Object.keys(quantityAndMeals);

    let categories: Record<string, string> | undefined;
    if (ingredientNames.length > 0) {
      categories = await categoriseIngredients(ingredientNames);
    }

    const items: ShoppingListItem[] = Object.entries(quantityAndMeals).map(
      ([ingredient, { quantities, meals }]) => ({
        ingredient,
        quantities: quantities.map((q) => ({
          value: q.value,
          unit: q.unit,
        })),
        category: categories?.[ingredient] ?? 'Other',
        meals: Array.from(meals),
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
  input: { dates?: number[] }
): Promise<GetShoppingListMcpResponse> {
  const items = await getShoppingList(c, input);
  const content = items
    .map((item) => {
      const quantityStr = item.quantities.map((q) => `${q.value || ''}${q.unit}`).join(', ');
      const mealStr = item.meals.length > 0 ? ` [${item.meals.join(', ')}]` : '';
      return `${item.ingredient} - ${quantityStr}${mealStr} (${item.category})`;
    })
    .join('\n');
  return { content };
}
