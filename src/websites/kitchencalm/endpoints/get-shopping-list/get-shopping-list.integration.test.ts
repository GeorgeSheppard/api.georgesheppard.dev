import { describe, expect, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';
import { updateRecipe, putMealPlanForUser } from '@core/dynamodb/utilities.js';
import { IRecipe } from '@core/types/recipes.js';
import { Unit } from '@core/types/recipes.js';
import { IMealPlan } from '@core/types/meal-plan.js';
import type { ShoppingListItem } from '@websites/kitchencalm/endpoints/get-shopping-list/get-shopping-list.js';

vi.mock('@websites/kitchencalm/utils/ingredient-categoriser.js', () => ({
  categoriseIngredients: vi.fn(async (ingredients: string[]) => {
    const map: Record<string, string> = {};
    for (const ingredient of ingredients) {
      map[ingredient] = 'Other';
    }
    return map;
  }),
}));

describe('Get Shopping List Endpoint', () => {
  test('should return empty shopping list when no meal plan exists', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);

    const response = await app.request(
      new Request('http://localhost/kitchencalm/shopping-list', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toEqual([]);
  });

  test('should aggregate ingredients from single recipe', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const componentId = uuidv4();

    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Pasta Carbonara',
      description: 'Classic Italian pasta',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main Pasta',
          servings: 2,
          ingredients: [
            {
              name: 'Spaghetti',
              quantity: { unit: Unit.GRAM, value: 400 },
            },
            {
              name: 'Eggs',
              quantity: { unit: Unit.NUMBER, value: 3 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId]: [
          {
            componentId,
            servings: 2,
          },
        ],
      },
    };

    await updateRecipe(dynamoClient.client, userId, recipe);
    await putMealPlanForUser(dynamoClient.client, userId, mealPlan);

    const response = await app.request(
      new Request('http://localhost/kitchencalm/shopping-list', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as ShoppingListItem[];

    expect(result).toHaveLength(2);
    const eggs = result.find((item) => item.ingredient === 'Eggs')!;
    const spaghetti = result.find((item) => item.ingredient === 'Spaghetti')!;
    expect(eggs).toBeDefined();
    expect(spaghetti).toBeDefined();
    expect(spaghetti.quantities[0].value).toBe(400);
    expect(spaghetti.quantities[0].unit).toBe(Unit.GRAM);
    expect(eggs.quantities[0].value).toBe(3);
    expect(eggs.quantities[0].unit).toBe(Unit.NUMBER);
  });

  test('should scale quantities based on servings', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const componentId = uuidv4();

    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Risotto',
      description: 'Italian rice dish',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main Course',
          servings: 2,
          ingredients: [
            {
              name: 'Rice',
              quantity: { unit: Unit.GRAM, value: 300 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId]: [
          {
            componentId,
            servings: 4,
          },
        ],
      },
    };

    await updateRecipe(dynamoClient.client, userId, recipe);
    await putMealPlanForUser(dynamoClient.client, userId, mealPlan);

    const response = await app.request(
      new Request('http://localhost/kitchencalm/shopping-list', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as ShoppingListItem[];

    expect(result).toHaveLength(1);
    const rice = result.find((item) => item.ingredient === 'Rice')!;
    expect(rice).toBeDefined();
    expect(rice.quantities[0].value).toBe(600);
    expect(rice.quantities[0].unit).toBe(Unit.GRAM);
  });

  test('should combine duplicate ingredients from multiple recipes', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId1 = uuidv4();
    const recipeId2 = uuidv4();
    const componentId1 = uuidv4();
    const componentId2 = uuidv4();

    const recipe1: IRecipe = {
      uuid: recipeId1,
      name: 'Pasta Carbonara',
      description: 'Classic Italian pasta',
      images: [],
      components: [
        {
          uuid: componentId1,
          name: 'Main Pasta',
          servings: 2,
          ingredients: [
            {
              name: 'Eggs',
              quantity: { unit: Unit.NUMBER, value: 3 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const recipe2: IRecipe = {
      uuid: recipeId2,
      name: 'Frittata',
      description: 'Italian egg dish',
      images: [],
      components: [
        {
          uuid: componentId2,
          name: 'Main Course',
          servings: 2,
          ingredients: [
            {
              name: 'Eggs',
              quantity: { unit: Unit.NUMBER, value: 6 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId1]: [
          {
            componentId: componentId1,
            servings: 2,
          },
        ],
      },
      'Tuesday - 01/09/2024': {
        [recipeId2]: [
          {
            componentId: componentId2,
            servings: 2,
          },
        ],
      },
    };

    await updateRecipe(dynamoClient.client, userId, recipe1);
    await updateRecipe(dynamoClient.client, userId, recipe2);
    await putMealPlanForUser(dynamoClient.client, userId, mealPlan);

    const response = await app.request(
      new Request('http://localhost/kitchencalm/shopping-list', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as ShoppingListItem[];
    expect(result).toHaveLength(1);
    const eggs = result.find((item) => item.ingredient === 'Eggs')!;
    expect(eggs).toBeDefined();
    expect(eggs.quantities[0].value).toBe(9);
    expect(eggs.quantities[0].unit).toBe(Unit.NUMBER);
  });

  test('should filter by exact date (same startDate and endDate)', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId1 = uuidv4();
    const recipeId2 = uuidv4();
    const componentId1 = uuidv4();
    const componentId2 = uuidv4();

    const recipe1: IRecipe = {
      uuid: recipeId1,
      name: 'Monday Recipe',
      description: 'Recipe for Monday',
      images: [],
      components: [
        {
          uuid: componentId1,
          name: 'Main Course',
          servings: 1,
          ingredients: [
            {
              name: 'Flour',
              quantity: { unit: Unit.GRAM, value: 100 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const recipe2: IRecipe = {
      uuid: recipeId2,
      name: 'Wednesday Recipe',
      description: 'Recipe for Wednesday',
      images: [],
      components: [
        {
          uuid: componentId2,
          name: 'Main Course',
          servings: 1,
          ingredients: [
            {
              name: 'Sugar',
              quantity: { unit: Unit.GRAM, value: 50 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId1]: [
          {
            componentId: componentId1,
            servings: 1,
          },
        ],
      },
      'Wednesday - 03/08/2024': {
        [recipeId2]: [
          {
            componentId: componentId2,
            servings: 1,
          },
        ],
      },
    };

    await updateRecipe(dynamoClient.client, userId, recipe1);
    await updateRecipe(dynamoClient.client, userId, recipe2);
    await putMealPlanForUser(dynamoClient.client, userId, mealPlan);

    const responseAll = await app.request(
      new Request('http://localhost/kitchencalm/shopping-list', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(responseAll.status).toBe(200);
    const resultAll = (await responseAll.json()) as ShoppingListItem[];
    expect(resultAll).toHaveLength(2);
    expect(resultAll.some((item) => item.ingredient === 'Flour')).toBe(true);
    expect(resultAll.some((item) => item.ingredient === 'Sugar')).toBe(true);

    // Filter to Monday only using same date for start and end
    const responseMonday = await app.request(
      new Request(
        'http://localhost/kitchencalm/shopping-list?startDate=Monday%20-%2001/08/2024&endDate=Monday%20-%2001/08/2024',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    );

    expect(responseMonday.status).toBe(200);
    const resultMonday = (await responseMonday.json()) as ShoppingListItem[];
    expect(resultMonday).toHaveLength(1);
    expect(resultMonday[0].ingredient).toBe('Flour');
    expect(resultMonday.some((item) => item.ingredient === 'Sugar')).toBe(false);
  });

  test('should filter by date range with multiple dates', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId1 = uuidv4();
    const recipeId2 = uuidv4();
    const recipeId3 = uuidv4();
    const componentId = uuidv4();

    const recipe1: IRecipe = {
      uuid: recipeId1,
      name: 'Recipe Monday',
      description: 'Recipe for Monday',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main Course',
          servings: 1,
          ingredients: [
            {
              name: 'Butter',
              quantity: { unit: Unit.GRAM, value: 50 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const recipe2: IRecipe = {
      uuid: recipeId2,
      name: 'Recipe Tuesday',
      description: 'Recipe for Tuesday',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main Course',
          servings: 1,
          ingredients: [
            {
              name: 'Milk',
              quantity: { unit: Unit.LITER, value: 1 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const recipe3: IRecipe = {
      uuid: recipeId3,
      name: 'Recipe Wednesday',
      description: 'Recipe for Wednesday',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main Course',
          servings: 1,
          ingredients: [
            {
              name: 'Cheese',
              quantity: { unit: Unit.GRAM, value: 100 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId1]: [
          {
            componentId,
            servings: 1,
          },
        ],
      },
      'Tuesday - 02/08/2024': {
        [recipeId2]: [
          {
            componentId,
            servings: 1,
          },
        ],
      },
      'Wednesday - 03/08/2024': {
        [recipeId3]: [
          {
            componentId,
            servings: 1,
          },
        ],
      },
    };

    await updateRecipe(dynamoClient.client, userId, recipe1);
    await updateRecipe(dynamoClient.client, userId, recipe2);
    await updateRecipe(dynamoClient.client, userId, recipe3);
    await putMealPlanForUser(dynamoClient.client, userId, mealPlan);

    // Filter from Monday to Tuesday (should include both)
    const responseRange = await app.request(
      new Request(
        'http://localhost/kitchencalm/shopping-list?startDate=Monday%20-%2001/08/2024&endDate=Tuesday%20-%2002/08/2024',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    );

    expect(responseRange.status).toBe(200);
    const resultRange = (await responseRange.json()) as ShoppingListItem[];
    expect(resultRange).toHaveLength(2);
    expect(resultRange.some((item) => item.ingredient === 'Butter')).toBe(true);
    expect(resultRange.some((item) => item.ingredient === 'Milk')).toBe(true);
    expect(resultRange.some((item) => item.ingredient === 'Cheese')).toBe(false);
  });

  test('should filter by startDate only', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId1 = uuidv4();
    const recipeId2 = uuidv4();
    const componentId = uuidv4();

    const recipe1: IRecipe = {
      uuid: recipeId1,
      name: 'Recipe Early',
      description: 'Recipe for early date',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main',
          servings: 1,
          ingredients: [
            {
              name: 'Salt',
              quantity: { unit: Unit.GRAM, value: 5 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const recipe2: IRecipe = {
      uuid: recipeId2,
      name: 'Recipe Late',
      description: 'Recipe for late date',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main',
          servings: 1,
          ingredients: [
            {
              name: 'Pepper',
              quantity: { unit: Unit.GRAM, value: 5 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId1]: [
          {
            componentId,
            servings: 1,
          },
        ],
      },
      'Wednesday - 03/08/2024': {
        [recipeId2]: [
          {
            componentId,
            servings: 1,
          },
        ],
      },
    };

    await updateRecipe(dynamoClient.client, userId, recipe1);
    await updateRecipe(dynamoClient.client, userId, recipe2);
    await putMealPlanForUser(dynamoClient.client, userId, mealPlan);

    // Only provide startDate (should include all dates from startDate onwards)
    const responseStartDate = await app.request(
      new Request(
        'http://localhost/kitchencalm/shopping-list?startDate=Tuesday%20-%2002/08/2024',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    );

    expect(responseStartDate.status).toBe(200);
    const resultStartDate = (await responseStartDate.json()) as ShoppingListItem[];
    expect(resultStartDate).toHaveLength(1);
    expect(resultStartDate[0].ingredient).toBe('Pepper');
    expect(resultStartDate.some((item) => item.ingredient === 'Salt')).toBe(false);
  });

  test('should filter by endDate only', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId1 = uuidv4();
    const recipeId2 = uuidv4();
    const componentId = uuidv4();

    const recipe1: IRecipe = {
      uuid: recipeId1,
      name: 'Recipe Early',
      description: 'Recipe for early date',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main',
          servings: 1,
          ingredients: [
            {
              name: 'Honey',
              quantity: { unit: Unit.GRAM, value: 10 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const recipe2: IRecipe = {
      uuid: recipeId2,
      name: 'Recipe Late',
      description: 'Recipe for late date',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main',
          servings: 1,
          ingredients: [
            {
              name: 'Vinegar',
              quantity: { unit: Unit.GRAM, value: 20 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId1]: [
          {
            componentId,
            servings: 1,
          },
        ],
      },
      'Wednesday - 03/08/2024': {
        [recipeId2]: [
          {
            componentId,
            servings: 1,
          },
        ],
      },
    };

    await updateRecipe(dynamoClient.client, userId, recipe1);
    await updateRecipe(dynamoClient.client, userId, recipe2);
    await putMealPlanForUser(dynamoClient.client, userId, mealPlan);

    // Only provide endDate (should include all dates up to endDate)
    const responseEndDate = await app.request(
      new Request(
        'http://localhost/kitchencalm/shopping-list?endDate=Tuesday%20-%2002/08/2024',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    );

    expect(responseEndDate.status).toBe(200);
    const resultEndDate = (await responseEndDate.json()) as ShoppingListItem[];
    expect(resultEndDate).toHaveLength(1);
    expect(resultEndDate[0].ingredient).toBe('Honey');
    expect(resultEndDate.some((item) => item.ingredient === 'Vinegar')).toBe(false);
  });

  test('should handle date range that excludes all dates', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const componentId = uuidv4();

    const recipe: IRecipe = {
      uuid: recipeId,
      name: 'Test Recipe',
      description: 'Test',
      images: [],
      components: [
        {
          uuid: componentId,
          name: 'Main',
          servings: 1,
          ingredients: [
            {
              name: 'Yeast',
              quantity: { unit: Unit.GRAM, value: 7 },
            },
          ],
          instructions: [],
        },
      ],
    };

    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        [recipeId]: [
          {
            componentId,
            servings: 1,
          },
        ],
      },
    };

    await updateRecipe(dynamoClient.client, userId, recipe);
    await putMealPlanForUser(dynamoClient.client, userId, mealPlan);

    // Filter with date range that doesn't include any planned dates
    const responseNoMatch = await app.request(
      new Request(
        'http://localhost/kitchencalm/shopping-list?startDate=Friday%20-%2005/08/2024&endDate=Sunday%20-%2007/08/2024',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    );

    expect(responseNoMatch.status).toBe(200);
    const resultNoMatch = (await responseNoMatch.json()) as ShoppingListItem[];
    expect(resultNoMatch).toHaveLength(0);
  });

  test('should require authentication', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/kitchencalm/shopping-list', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
  });
});
