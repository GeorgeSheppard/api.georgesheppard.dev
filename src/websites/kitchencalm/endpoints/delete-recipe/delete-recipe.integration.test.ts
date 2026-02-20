/**
 * Integration tests for Delete Recipe endpoint
 */
import { describe, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';
import { updateRecipe as updateRecipeInDynamo } from '@core/dynamodb/utilities.js';

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
