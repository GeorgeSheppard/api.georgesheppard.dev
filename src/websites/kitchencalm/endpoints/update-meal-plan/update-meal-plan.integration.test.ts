/**
 * Integration tests for Update Meal Plan endpoint
 */
import { describe, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';
import { IMealPlan } from '@core/types/meal-plan.js';

describe('Update Meal Plan Endpoint', () => {
  test('should create a new meal plan', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const componentId = uuidv4();

    const mealPlanArray = [
      {
        date: 'Monday - 01/08/2024',
        plan: {
          [recipeId]: [
            {
              componentId,
              servings: 2,
            },
          ],
        },
      },
    ];

    const response = await app.request(
      new Request('http://localhost/kitchencalm/meal-plan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(mealPlanArray),
      })
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean };
    expect(result.success).toBe(true);

    // Verify by getting meal plan
    const getResponse = await app.request(
      new Request('http://localhost/kitchencalm/meal-plan', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    const retrieved = await getResponse.json();
    expect(retrieved).toEqual(mealPlanArray);
  });

  test('should require authentication', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/kitchencalm/meal-plan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(401);
  });

  test('should handle empty meal plan', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);

    const emptyMealPlan: Array<{ date: string; plan: Record<string, unknown> }> = [];

    const response = await app.request(
      new Request('http://localhost/kitchencalm/meal-plan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(emptyMealPlan),
      })
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean };
    expect(result.success).toBe(true);
  });
});
