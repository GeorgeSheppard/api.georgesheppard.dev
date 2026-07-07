import { describe, expect, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';
import { updateRecipe, putMealPlanForUser } from '@core/dynamodb/utilities.js';
import { IRecipe, Unit } from '@core/types/recipes.js';
import { IMealPlan } from '@core/types/meal-plan.js';
import type { GenerateShoppingListResponse } from './generate-shopping-list.js';

vi.mock('@websites/mise/utils/ingredient-categoriser.js', () => ({
  categoriseIngredients: vi.fn(async (ingredients: string[]) => {
    const map: Record<string, string> = {};
    for (const ingredient of ingredients) {
      map[ingredient] = 'Other';
    }
    return map;
  }),
}));

describe('Generate Shopping List Endpoint', () => {
  test('should generate, persist, and return the shopping list', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const componentId = uuidv4();

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
          ingredients: [{ name: 'Spaghetti', quantity: { unit: Unit.GRAM, value: 400 } }],
          instructions: [],
        },
      ],
    };
    const mealPlan: IMealPlan = [
      { date: 1, plan: [{ recipeId, components: [{ componentId, servings: 1 }] }] },
    ];

    await updateRecipe(dynamoClient.client, userId, recipe);
    await putMealPlanForUser(dynamoClient.client, userId, mealPlan);

    const response = await app.request(
      new Request('http://localhost/mise/shopping-list/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as GenerateShoppingListResponse;
    expect(result.items).toHaveLength(1);
    expect(result.items[0].ingredient).toBe('Spaghetti');
    expect(typeof result.generatedAt).toBe('number');

    const activeResponse = await app.request(
      new Request('http://localhost/mise/shopping-list/active', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(activeResponse.status).toBe(200);
    const active = await activeResponse.json();
    expect(active).toEqual(result);
  });

  test('should return 401 without a valid token', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/mise/shopping-list/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(401);
  });
});
