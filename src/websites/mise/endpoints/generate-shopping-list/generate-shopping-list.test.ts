import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateShoppingList } from './generate-shopping-list.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import type { IRecipe } from '@core/types/recipes.js';
import { Unit } from '@core/types/recipes.js';
import type { IMealPlan } from '@core/types/meal-plan.js';

vi.mock('@core/dynamodb/utilities.js');
vi.mock('@websites/mise/utils/ingredient-categoriser.js');

import {
  getAllRecipesForUser,
  getMealPlanForUser,
  putShoppingListForUser,
} from '@core/dynamodb/utilities.js';
import { categoriseIngredients } from '@websites/mise/utils/ingredient-categoriser.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('generateShoppingList handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  it('should persist an empty shopping list when meal plan is empty', async () => {
    vi.mocked(getAllRecipesForUser).mockResolvedValue([]);
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);

    const result = await generateShoppingList(mockContext());

    expect(result).toEqual({ items: [], generatedAt: Date.now() });
    expect(putShoppingListForUser).toHaveBeenCalledWith(expect.anything(), validUserId, {
      items: [],
      generatedAt: Date.now(),
    });
  });

  it('should generate, persist, and return the shopping list', async () => {
    const recipeId = 'recipe-1';
    const componentId = 'comp-1';
    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Pasta',
      description: '',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main',
          servings: 2,
          ingredients: [{ name: 'Spaghetti', quantity: { unit: Unit.GRAM, value: 400 } }],
          instructions: [],
        },
      ],
    };
    const mealPlan: IMealPlan = [
      {
        date: 1,
        plan: [{ recipeId, components: [{ componentId, servings: 2 }] }],
      },
    ];

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({ Spaghetti: 'Rice, Pasta & Grains' });

    const result = await generateShoppingList(mockContext());

    expect(result.generatedAt).toBe(Date.now());
    expect(result.items).toEqual([
      {
        ingredient: 'Spaghetti',
        quantities: [{ value: 400, unit: Unit.GRAM }],
        category: 'Rice, Pasta & Grains',
        meals: ['Pasta'],
      },
    ]);
    expect(putShoppingListForUser).toHaveBeenCalledWith(expect.anything(), validUserId, result);
  });

  it('should pass dates through to the shopping list computation', async () => {
    vi.mocked(getAllRecipesForUser).mockResolvedValue([]);
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);

    await generateShoppingList(mockContext(), { dates: [1, 2] });

    expect(getAllRecipesForUser).toHaveBeenCalled();
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getAllRecipesForUser).mockRejectedValue(new Error('DynamoDB error'));
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);

    await expect(generateShoppingList(mockContext())).rejects.toThrow('DynamoDB error');
    expect(putShoppingListForUser).not.toHaveBeenCalled();
  });
});
