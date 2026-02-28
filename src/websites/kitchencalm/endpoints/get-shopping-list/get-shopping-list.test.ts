import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getShoppingList } from './get-shopping-list.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import type { IRecipe } from '@core/types/recipes.js';
import { Unit } from '@core/types/recipes.js';
import type { IMealPlan } from '@core/types/meal-plan.js';

vi.mock('@core/dynamodb/utilities.js');
vi.mock('@websites/kitchencalm/utils/ingredient-categoriser.js');

import { getAllRecipesForUser, getMealPlanForUser } from '@core/dynamodb/utilities.js';
import { categoriseIngredients } from '@websites/kitchencalm/utils/ingredient-categoriser.js';

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

  it('should return empty array when meal plan is empty', async () => {
    vi.mocked(getAllRecipesForUser).mockResolvedValue([]);
    vi.mocked(getMealPlanForUser).mockResolvedValue({});

    const result = await getShoppingList(mockContext());

    expect(result).toEqual([]);
    expect(categoriseIngredients).not.toHaveBeenCalled();
  });

  it('should categorise ingredients via OpenAI', async () => {
    const recipeId = 'recipe-1';
    const componentId = 'comp-1';
    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Pasta',
      description: '',
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
    expect(result).toHaveLength(2);
    const spaghetti = result.find((item) => item.ingredient === 'Spaghetti');
    const eggs = result.find((item) => item.ingredient === 'Eggs');
    expect(spaghetti).toEqual({
      ingredient: 'Spaghetti',
      quantities: [{ value: 400, unit: Unit.GRAM }],
      category: 'Rice, Pasta & Grains',
      meals: ['Pasta'],
    });
    expect(eggs).toEqual({
      ingredient: 'Eggs',
      quantities: [{ value: 3, unit: Unit.NUMBER }],
      category: 'Dairy & Eggs',
      meals: ['Pasta'],
    });
  });

  it('should filter ingredients by specific dates', async () => {
    const recipeId = 'recipe-1';
    const componentId = 'comp-1';
    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Pasta',
      description: '',
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
      dates: ['01/08/2024'],
    });

    expect(categoriseIngredients).toHaveBeenCalledWith(['Flour']);
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getAllRecipesForUser).mockRejectedValue(new Error('DynamoDB error'));
    vi.mocked(getMealPlanForUser).mockResolvedValue({});

    await expect(getShoppingList(mockContext())).rejects.toThrow('DynamoDB error');
  });

  it('should handle single-digit day/month dates like 19/2/2026', async () => {
    const recipeId = 'recipe-1';
    const componentId = 'comp-1';
    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Test Recipe',
      description: '',
      components: [
        {
          uuid: componentId,
          name: 'Main',
          servings: 2,
          ingredients: [{ name: 'Ingredient A', quantity: { unit: Unit.GRAM, value: 100 } }],
          instructions: [],
        },
      ],
    };

    // Meal plan with single-digit day/month format like user's actual data
    const mealPlan: IMealPlan = {
      'Thursday - 19/2/2026': {
        [recipeId]: [{ componentId, servings: 2 }],
      },
      'Friday - 20/2/2026': {
        [recipeId]: [{ componentId, servings: 1 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({
      'Ingredient A': 'Fresh Fruit & Vegetables',
    });

    // Test with single-digit format
    const result = await getShoppingList(mockContext(), {
      dates: ['19/2/2026'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].ingredient).toBe('Ingredient A');
  });

  it('should match dates with zero-padded format against single-digit meal plan', async () => {
    const recipeId = 'recipe-1';
    const componentId = 'comp-1';
    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Test Recipe',
      description: '',
      components: [
        {
          uuid: componentId,
          name: 'Main',
          servings: 1,
          ingredients: [{ name: 'Ingredient B', quantity: { unit: Unit.GRAM, value: 50 } }],
          instructions: [],
        },
      ],
    };

    // Meal plan with single-digit day/month format
    const mealPlan: IMealPlan = {
      'Thursday - 19/2/2026': {
        [recipeId]: [{ componentId, servings: 1 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({
      'Ingredient B': 'Fresh Fruit & Vegetables',
    });

    // Test with zero-padded format (what user sends from frontend)
    const result = await getShoppingList(mockContext(), {
      dates: ['19/02/2026'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].ingredient).toBe('Ingredient B');
  });

  it('should handle multiple dates with mixed formats', async () => {
    const recipeId1 = 'recipe-1';
    const recipeId2 = 'recipe-2';
    const componentId = 'comp-1';

    const recipe1: IRecipe = {
      uuid: recipeId1,
      name: 'Recipe 1',
      description: '',
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

    const recipe2: IRecipe = {
      uuid: recipeId2,
      name: 'Recipe 2',
      description: '',
      components: [
        {
          uuid: componentId,
          name: 'Main',
          servings: 1,
          ingredients: [{ name: 'Sugar', quantity: { unit: Unit.GRAM, value: 50 } }],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Wednesday - 18/2/2026': {
        [recipeId1]: [{ componentId, servings: 1 }],
      },
      'Thursday - 19/2/2026': {
        [recipeId2]: [{ componentId, servings: 1 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe1, recipe2]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({
      Flour: 'Rice, Pasta & Grains',
      Sugar: 'Baking',
    });

    // Request with both single and double-digit formats (should both work)
    const result = await getShoppingList(mockContext(), {
      dates: ['18/02/2026', '19/2/2026'],
    });

    expect(result).toHaveLength(2);
    expect(result.some((item) => item.ingredient === 'Flour')).toBe(true);
    expect(result.some((item) => item.ingredient === 'Sugar')).toBe(true);
  });

  it('should handle recipes with zero servings (like in user meal plan)', async () => {
    const recipeId = '1b46cc01-db3c-4657-8afe-85365b3d86b9';
    const componentId = 'f79d1774-7259-4207-a6ba-80654d23ae01';

    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'User Recipe',
      description: '',
      components: [
        {
          uuid: componentId,
          name: 'Main Component',
          servings: 2,
          ingredients: [{ name: 'Ingredient X', quantity: { unit: Unit.GRAM, value: 100 } }],
          instructions: [],
        },
      ],
    };

    // Meal plan like user's: Thursday 19/2 has servings: 2, Friday 20/2 has servings: 0
    const mealPlan: IMealPlan = {
      'Wednesday - 18/2/2026': {
        [recipeId]: [{ componentId, servings: 0 }],
      },
      'Thursday - 19/2/2026': {
        [recipeId]: [{ componentId, servings: 2 }],
      },
      'Friday - 20/2/2026': {
        [recipeId]: [{ componentId, servings: 0 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({
      'Ingredient X': 'Fresh Fruit & Vegetables',
    });

    // Request Thursday 19/2/2026 which has servings: 2
    const result = await getShoppingList(mockContext(), {
      dates: ['19/2/2026'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].ingredient).toBe('Ingredient X');
    expect(result[0].quantities[0].value).toBe(100); // 100 grams from ingredient definition
  });

  it('should skip when recipe ID does not match any loaded recipes', async () => {
    const recipeId = 'recipe-1';
    const unknownRecipeId = 'recipe-unknown';
    const componentId = 'comp-1';

    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Recipe 1',
      description: '',
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

    // Meal plan has a recipe ID that doesn't exist
    const mealPlan: IMealPlan = {
      'Thursday - 19/2/2026': {
        [unknownRecipeId]: [{ componentId, servings: 1 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({});

    const result = await getShoppingList(mockContext(), {
      dates: ['19/2/2026'],
    });

    // Should be empty because the recipe ID doesn't match
    expect(result).toHaveLength(0);
  });

  it('should skip when component ID does not match any recipe components', async () => {
    const recipeId = 'recipe-1';
    const componentId = 'comp-1';
    const unknownComponentId = 'comp-unknown';

    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Recipe 1',
      description: '',
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

    // Meal plan has a component ID that doesn't exist in the recipe
    const mealPlan: IMealPlan = {
      'Thursday - 19/2/2026': {
        [recipeId]: [{ componentId: unknownComponentId, servings: 1 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({});

    const result = await getShoppingList(mockContext(), {
      dates: ['19/2/2026'],
    });

    // Should be empty because the component ID doesn't match
    expect(result).toHaveLength(0);
  });

  it('should correctly match recipe and component IDs from meal plan', async () => {
    const recipeId = 'recipe-abc123';
    const componentId = 'comp-xyz789';

    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Pasta Carbonara',
      description: '',
      components: [
        {
          uuid: componentId,
          name: 'Main Pasta',
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
      'Thursday - 19/2/2026': {
        [recipeId]: [{ componentId, servings: 2 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({
      Spaghetti: 'Rice, Pasta & Grains',
      Eggs: 'Dairy & Eggs',
    });

    const result = await getShoppingList(mockContext(), {
      dates: ['19/2/2026'],
    });

    expect(result).toHaveLength(2);
    expect(result.some((item) => item.ingredient === 'Spaghetti')).toBe(true);
    expect(result.some((item) => item.ingredient === 'Eggs')).toBe(true);
  });

  it('should handle multiple recipes and components on same date', async () => {
    const recipeId1 = 'recipe-1';
    const recipeId2 = 'recipe-2';
    const componentId1 = 'comp-1';
    const componentId2 = 'comp-2';

    const recipe1: IRecipe = {
      uuid: recipeId1,
      name: 'Pasta',
      description: '',
      components: [
        {
          uuid: componentId1,
          name: 'Main',
          servings: 1,
          ingredients: [{ name: 'Pasta', quantity: { unit: Unit.GRAM, value: 200 } }],
          instructions: [],
        },
      ],
    };

    const recipe2: IRecipe = {
      uuid: recipeId2,
      name: 'Salad',
      description: '',
      components: [
        {
          uuid: componentId2,
          name: 'Main',
          servings: 1,
          ingredients: [{ name: 'Lettuce', quantity: { unit: Unit.GRAM, value: 100 } }],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Thursday - 19/2/2026': {
        [recipeId1]: [{ componentId: componentId1, servings: 1 }],
        [recipeId2]: [{ componentId: componentId2, servings: 1 }],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe1, recipe2]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({
      Pasta: 'Rice, Pasta & Grains',
      Lettuce: 'Fresh Fruit & Vegetables',
    });

    const result = await getShoppingList(mockContext(), {
      dates: ['19/2/2026'],
    });

    expect(result).toHaveLength(2);
    expect(result.some((item) => item.ingredient === 'Pasta')).toBe(true);
    expect(result.some((item) => item.ingredient === 'Lettuce')).toBe(true);
  });

  it('should handle recipe with multiple components', async () => {
    const recipeId = 'recipe-1';
    const componentId1 = 'comp-1';
    const componentId2 = 'comp-2';

    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Complex Recipe',
      description: '',
      components: [
        {
          uuid: componentId1,
          name: 'Main',
          servings: 1,
          ingredients: [{ name: 'Rice', quantity: { unit: Unit.GRAM, value: 200 } }],
          instructions: [],
        },
        {
          uuid: componentId2,
          name: 'Sauce',
          servings: 1,
          ingredients: [{ name: 'Soy Sauce', quantity: { unit: Unit.MILLILITER, value: 50 } }],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Thursday - 19/2/2026': {
        [recipeId]: [
          { componentId: componentId1, servings: 1 },
          { componentId: componentId2, servings: 1 },
        ],
      },
    };

    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);
    vi.mocked(categoriseIngredients).mockResolvedValue({
      Rice: 'Rice, Pasta & Grains',
      'Soy Sauce': 'Sauces & Condiments',
    });

    const result = await getShoppingList(mockContext(), {
      dates: ['19/2/2026'],
    });

    expect(result).toHaveLength(2);
    expect(result.some((item) => item.ingredient === 'Rice')).toBe(true);
    expect(result.some((item) => item.ingredient === 'Soy Sauce')).toBe(true);
  });

  it('should throw when categorisation fails', async () => {
    const recipeId = 'recipe-1';
    const componentId = 'comp-1';
    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Pasta',
      description: '',
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
