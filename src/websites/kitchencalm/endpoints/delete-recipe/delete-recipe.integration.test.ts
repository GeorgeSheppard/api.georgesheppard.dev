/**
 * Integration tests for Delete Recipe endpoint
 */
import { describe, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';
import {
  updateRecipe as updateRecipeInDynamo,
  getMealPlanForUser,
  putMealPlanForUser,
} from '@core/dynamodb/utilities.js';

describe('Delete Recipe Endpoint', () => {
  test('should delete an existing recipe', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();

    // Create a recipe first
    const recipe = {
      uuid: recipeId as any,
      name: 'Recipe to Delete',
      description: 'This will be deleted',
      images: [],
      components: [
        {
          name: 'Component',
          uuid: uuidv4() as any,
          ingredients: [],
          instructions: [],
        },
      ],
    };

    await updateRecipeInDynamo(dynamoClient.client, userId, recipe);

    // Delete the recipe
    const deleteResponse = await app.request(
      new Request(`http://localhost/kitchencalm/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(deleteResponse.status).toBe(200);
    const result = (await deleteResponse.json()) as { success: boolean; uuid: string };
    expect(result.success).toBe(true);
    expect(result.uuid).toBe(recipeId);
  });

  test('should remove deleted recipe from meal plan', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const otherRecipeId = uuidv4();

    const recipe = {
      uuid: recipeId as any,
      name: 'Recipe to Delete',
      description: 'This will be deleted',
      images: [],
      components: [],
    };

    await updateRecipeInDynamo(dynamoClient.client, userId, recipe);

    // Set up a meal plan referencing the recipe and another recipe
    await putMealPlanForUser(dynamoClient.client, userId, [
      {
        date: 1000000000000,
        plan: [
          { recipeId: recipeId as any, components: [] },
          { recipeId: otherRecipeId as any, components: [] },
        ],
      },
    ]);

    const deleteResponse = await app.request(
      new Request(`http://localhost/kitchencalm/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(deleteResponse.status).toBe(200);

    const mealPlan = await getMealPlanForUser(dynamoClient.client, userId);
    expect(mealPlan).toEqual([
      {
        date: 1000000000000,
        plan: [{ recipeId: otherRecipeId, components: [] }],
      },
    ]);
  });

  test('should remove day entry when it only contained the deleted recipe', async ({
    dynamoClient,
  }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();

    const recipe = {
      uuid: recipeId as any,
      name: 'Recipe to Delete',
      description: 'This will be deleted',
      images: [],
      components: [],
    };

    await updateRecipeInDynamo(dynamoClient.client, userId, recipe);

    await putMealPlanForUser(dynamoClient.client, userId, [
      {
        date: 1000000000000,
        plan: [{ recipeId: recipeId as any, components: [] }],
      },
    ]);

    const deleteResponse = await app.request(
      new Request(`http://localhost/kitchencalm/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(deleteResponse.status).toBe(200);

    const mealPlan = await getMealPlanForUser(dynamoClient.client, userId);
    expect(mealPlan).toEqual([]);
  });

  test('should require authentication', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const recipeId = uuidv4();

    const response = await app.request(
      new Request(`http://localhost/kitchencalm/recipes/${recipeId}`, {
        method: 'DELETE',
      })
    );

    expect(response.status).toBe(401);
  });
});
