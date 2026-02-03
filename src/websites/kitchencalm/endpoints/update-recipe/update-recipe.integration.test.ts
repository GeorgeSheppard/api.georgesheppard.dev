/**
 * Integration tests for Update Recipe endpoint
 */
import { describe, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';

describe('Update Recipe Endpoint', () => {
  test('should create a new recipe with auto-generated UUID', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);

    const recipeData = {
      name: 'Pasta Carbonara',
      description: 'Classic Italian pasta dish',
      images: [
        {
          timestamp: Date.now(),
          key: `${userId}/pasta.jpg`,
        },
      ],
      components: [
        {
          name: 'Main Pasta',
          uuid: uuidv4(),
          ingredients: [
            {
              name: 'Spaghetti',
              quantity: {
                unit: 'g',
                value: 400,
              },
            },
          ],
          instructions: [
            {
              text: 'Boil pasta',
              optional: false,
            },
          ],
          servings: 2,
        },
      ],
    };

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(recipeData),
      })
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean; uuid: string };
    expect(result.success).toBe(true);
    expect(result.uuid).toBeDefined();
    expect(result.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test('should update an existing recipe with provided UUID', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();

    const recipeData = {
      uuid: recipeId,
      name: 'Updated Pasta Carbonara',
      description: 'Updated Italian pasta dish',
      images: [],
      components: [
        {
          name: 'Main Pasta',
          uuid: uuidv4(),
          ingredients: [
            {
              name: 'Spaghetti',
              quantity: {
                unit: 'g',
                value: 500,
              },
            },
          ],
          instructions: [
            {
              text: 'Boil pasta until al dente',
              optional: false,
            },
          ],
          servings: 4,
        },
      ],
    };

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(recipeData),
      })
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean; uuid: string };
    expect(result.success).toBe(true);
    expect(result.uuid).toBe(recipeId);
  });

  test('should require authentication', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const recipeData = {
      name: 'Test Recipe',
      description: 'Test',
      images: [],
      components: [],
    };

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recipeData),
      })
    );

    expect(response.status).toBe(401);
  });

  test('should validate recipe data', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);

    const invalidRecipeData = {
      name: 'Test Recipe',
      // Missing required fields: description, images, components
    };

    const response = await app.request(
      new Request('http://localhost/kitchencalm/recipes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(invalidRecipeData),
      })
    );

    expect(response.status).toBe(400);
  });
});
