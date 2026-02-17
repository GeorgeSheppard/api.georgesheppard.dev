/**
 * Integration tests for Get Meal Plan endpoint
 */
import { describe, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';
import { putMealPlanForUser } from '@core/dynamodb/utilities.js';
import { IMealPlan } from '@core/types/meal-plan.js';

describe('Get Meal Plan Endpoint', () => {
  test('should return empty array when no meal plan exists', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);

    const response = await app.request(
      new Request('http://localhost/kitchencalm/meal-plan', {
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

  test('should return meal plan as sorted array when it exists', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const componentId = uuidv4();

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

    await putMealPlanForUser(dynamoClient.client, userId, mealPlan);

    const response = await app.request(
      new Request('http://localhost/kitchencalm/meal-plan', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toEqual([
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
    ]);
  });

  test('should require authentication', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/kitchencalm/meal-plan', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
  });
});
