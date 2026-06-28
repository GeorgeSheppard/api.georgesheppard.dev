/**
 * Integration tests for Update Meal Plan endpoint
 */
import { describe, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';
import { getMealPlanForUser } from '@core/dynamodb/utilities.js';

function getTodayTimestamp(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

describe('Update Meal Plan Endpoint', () => {
  test('should create a new meal plan with array structure', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const componentId = uuidv4();

    const today = getTodayTimestamp();
    const mealPlan = [
      {
        date: today,
        plan: [
          {
            recipeId,
            components: [
              {
                componentId,
                servings: 2,
              },
            ],
          },
        ],
      },
      {
        date: today + 24 * 60 * 60 * 1000,
        plan: [
          {
            recipeId,
            components: [
              {
                componentId,
                servings: 3,
              },
            ],
          },
        ],
      },
    ];

    const response = await app.request(
      new Request('http://localhost/mise/meal-plan', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mealPlan),
      })
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean };
    expect(result.success).toBe(true);

    // Verify the meal plan was saved to DynamoDB
    const savedMealPlan = await getMealPlanForUser(dynamoClient.client, userId);
    expect(savedMealPlan).toEqual(mealPlan);
  });

  test('should replace entire meal plan on update', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId1 = uuidv4();
    const recipeId2 = uuidv4();
    const componentId = uuidv4();

    const today = getTodayTimestamp();
    const oldMealPlan = [
      {
        date: today,
        plan: [
          {
            recipeId: recipeId1,
            components: [
              {
                componentId,
                servings: 1,
              },
            ],
          },
        ],
      },
    ];

    // Create initial meal plan
    await app.request(
      new Request('http://localhost/mise/meal-plan', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(oldMealPlan),
      })
    );

    // Update with new meal plan
    const newMealPlan = [
      {
        date: today,
        plan: [
          {
            recipeId: recipeId2,
            components: [
              {
                componentId,
                servings: 5,
              },
            ],
          },
        ],
      },
    ];

    const response = await app.request(
      new Request('http://localhost/mise/meal-plan', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newMealPlan),
      })
    );

    expect(response.status).toBe(200);

    // Verify the meal plan was replaced
    const savedMealPlan = await getMealPlanForUser(dynamoClient.client, userId);
    expect(savedMealPlan).toEqual(newMealPlan);
  });

  test('should return 401 without valid JWT', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/mise/meal-plan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([]),
      })
    );

    expect(response.status).toBe(401);
  });

  test('should return 400 with invalid request body', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);

    // Invalid: missing required date field
    const invalidMealPlan = [
      {
        plan: [],
      },
    ];

    const response = await app.request(
      new Request('http://localhost/mise/meal-plan', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidMealPlan),
      })
    );

    expect(response.status).toBe(400);
  });
});
