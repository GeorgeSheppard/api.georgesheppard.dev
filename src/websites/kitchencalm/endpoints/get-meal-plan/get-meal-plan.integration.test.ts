/**
 * Integration tests for Get Meal Plan endpoint
 */
import { describe, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { test } from '@test/fixtures.js';
import { createTestApp } from '@test/utils/app.js';
import { signJwt } from '@core/utils/jwt.js';
import { putMealPlanForUser, getMealPlanForUser } from '@core/dynamodb/utilities.js';
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

    const today = new Date();
    const dateStr = `Monday - ${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    const mealPlan: IMealPlan = {
      [dateStr]: {
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
        date: dateStr,
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

  test('should update stale meal plan dates when fetching', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const componentId = uuidv4();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Create a meal plan from 30 days ago
    const oldDate = new Date(today);
    oldDate.setDate(oldDate.getDate() - 30);
    const oldDateStr = `Monday - ${String(oldDate.getDate()).padStart(2, '0')}/${String(oldDate.getMonth() + 1).padStart(2, '0')}/${oldDate.getFullYear()}`;

    const oldMealPlan: IMealPlan = {
      [oldDateStr]: {
        [recipeId]: [
          {
            componentId,
            servings: 2,
          },
        ],
      },
    };

    await putMealPlanForUser(dynamoClient.client, userId, oldMealPlan);

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

    // Result should have been updated
    expect(result.length).toBe(1);
    expect(result[0].plan).toEqual({
      [recipeId]: [
        {
          componentId,
          servings: 2,
        },
      ],
    });

    // The date should have been updated to 7 days ago
    const resultDate = result[0].date;
    const parts = resultDate.split(' - ');
    const [day, month, year] = parts[1].split('/').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    parsedDate.setHours(0, 0, 0, 0);

    expect(parsedDate.getTime()).toBe(sevenDaysAgo.getTime());

    // Verify the database was updated
    const updatedMealPlan = await getMealPlanForUser(dynamoClient.client, userId);
    expect(updatedMealPlan).toEqual({
      [resultDate]: {
        [recipeId]: [
          {
            componentId,
            servings: 2,
          },
        ],
      },
    });
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
