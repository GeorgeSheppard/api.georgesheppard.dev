import { describe, expect, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';
import { updateRecipe, putMealPlanForUser } from '@core/dynamodb/utilities.js';
import { IRecipe } from '@core/types/recipes.js';
import { Unit } from '@core/types/recipes.js';
import { IMealPlan } from '@core/types/meal-plan.js';

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
    const result = await response.text();
    expect(result).toBe('');
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
    const result = await response.text();

    expect(result).toContain('Eggs');
    expect(result).toContain('Spaghetti');
    expect(result).toContain('400 g');
    expect(result).toContain('3');
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
    const result = await response.text();

    expect(result).toContain('Rice');
    expect(result).toContain('600 g');
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
    const result = await response.text();

    expect(result).toContain('Eggs');
    expect(result).toContain('9');
  });

  test('should filter by date range', async ({ dynamoClient }) => {
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
      'Wednesday - 01/10/2024': {
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
    const resultAll = await responseAll.text();
    expect(resultAll).toContain('Flour');
    expect(resultAll).toContain('Sugar');

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
    const resultMonday = await responseMonday.text();
    expect(resultMonday).toContain('Flour');
    expect(resultMonday).not.toContain('Sugar');
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
