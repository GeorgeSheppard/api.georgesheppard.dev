import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getShoppingList } from './get-shopping-list.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import type { IRecipe } from '@core/types/recipes.js';
import { Unit } from '@core/types/recipes.js';
import type { IMealPlan } from '@core/types/meal-plan.js';

vi.mock('@core/dynamodb/utilities.js');
vi.mock('@core/utils/ingredient-categoriser.js');

import { getAllRecipesForUser, getMealPlanForUser } from '@core/dynamodb/utilities.js';
import { categoriseIngredients } from '@core/utils/ingredient-categoriser.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('getShoppingList handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty string when meal plan is empty', async () => {
    vi.mocked(getAllRecipesForUser).mockResolvedValue([]);
    vi.mocked(getMealPlanForUser).mockResolvedValue({});

    const result = await getShoppingList(mockContext());

    expect(result).toBe('');
    expect(categoriseIngredients).not.toHaveBeenCalled();
  });

  it('should categorise ingredients via OpenAI', async () => {
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
          ingredients: [
            { name: 'Spaghetti', quantity: { unit: Unit.GRAM, value: 400 } },
            { name: 'Eggs', quantity: { unit: Unit.NUMBER, value: 3 } },
          ],
          instructions: [],
        },
      ],
    };
    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId]: [{ componentId, servings: 2 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({
      Spaghetti: 'Rice, Pasta & Grains',
      Eggs: 'Dairy & Eggs',
    });

    const result = await getShoppingList(mockContext());

    expect(categoriseIngredients).toHaveBeenCalledWith(['Spaghetti', 'Eggs']);
    expect(result).toContain('Rice, Pasta & Grains');
    expect(result).toContain('Dairy & Eggs');
    expect(result).toContain('Spaghetti');
    expect(result).toContain('Eggs');
  });

  it('should pass date range to filter dates', async () => {
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
          servings: 1,
          ingredients: [{ name: 'Flour', quantity: { unit: Unit.GRAM, value: 100 } }],
          instructions: [],
        },
      ],
    };
    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId]: [{ componentId, servings: 1 }],
      },
      'Wednesday - 03/08/2024': {
        [recipeId]: [{ componentId, servings: 1 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({ Flour: 'Baking' });

    await getShoppingList(mockContext(), {
      startDate: 'Monday - 01/08/2024',
      endDate: 'Monday - 01/08/2024',
    });

    expect(categoriseIngredients).toHaveBeenCalledWith(['Flour']);
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getAllRecipesForUser).mockRejectedValue(new Error('DynamoDB error'));
    vi.mocked(getMealPlanForUser).mockResolvedValue({});

    await expect(getShoppingList(mockContext())).rejects.toThrow('DynamoDB error');
  });

  it('should throw when categorisation fails', async () => {
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
          servings: 1,
          ingredients: [{ name: 'Flour', quantity: { unit: Unit.GRAM, value: 100 } }],
          instructions: [],
        },
      ],
    };
    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId]: [{ componentId, servings: 1 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockRejectedValue(new Error('OpenAI error'));

    await expect(getShoppingList(mockContext())).rejects.toThrow('OpenAI error');
  });
});
