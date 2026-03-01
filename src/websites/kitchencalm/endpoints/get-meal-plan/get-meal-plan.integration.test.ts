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
import { GetMealPlanResponse } from './get-meal-plan.js';

describe('Get Meal Plan Endpoint', () => {
  test('should return meal plan entries for 1 week past to 2 weeks future when empty', async ({
    dynamoClient,
  }) => {
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
    const result = (await response.json()) as GetMealPlanResponse;

    // Should have 21 empty entries (1 week past + 2 weeks future)
    expect(result.length).toBe(21);
    for (const entry of result) {
      expect(entry.plan).toEqual([]);
    }

    // Verify dates are consecutive starting from 1 week ago
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const oneWeekAgo = todayTimestamp - 7 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 21; i++) {
      expect(result[i].date).toBe(oneWeekAgo + i * 24 * 60 * 60 * 1000);
    }
  });

  test('should return existing meal plan entries plus generated empty ones for 1 week past to 2 weeks future', async ({
    dynamoClient,
  }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const componentId = uuidv4();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const oneWeekAgo = todayTimestamp - 7 * 24 * 60 * 60 * 1000;

    // Create a meal plan with entries from 1 week ago and a few future days
    const mealPlan: IMealPlan = [
      {
        date: oneWeekAgo,
        plan: [
          {
            recipeId,
            components: [
              {
                componentId,
                servings: 1,
              },
            ],
          },
        ],
      },
      {
        date: todayTimestamp,
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
        date: todayTimestamp + 5 * 24 * 60 * 60 * 1000,
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
    const result = (await response.json()) as GetMealPlanResponse;

    // Should have 21 entries (1 week past + 2 weeks future)
    expect(result.length).toBe(21);

    // First day (1 week ago) should have the recipe
    expect(result[0].date).toBe(oneWeekAgo);
    expect(result[0].plan.length).toBe(1);

    // Day at index 7 should be today with the recipe
    expect(result[7].date).toBe(todayTimestamp);
    expect(result[7].plan.length).toBe(1);

    // Day at index 12 (5 days from today) should have the recipe
    expect(result[12].date).toBe(todayTimestamp + 5 * 24 * 60 * 60 * 1000);
    expect(result[12].plan.length).toBe(1);
  });

  test('should keep historical entries and add future entries for 2-week window', async ({
    dynamoClient,
  }) => {
    const app = await createTestApp({ dynamoClient });
    const userId = uuidv4();
    const token = await signJwt(userId);
    const recipeId = uuidv4();
    const componentId = uuidv4();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const yesterday = todayTimestamp - 24 * 60 * 60 * 1000;

    // Create a meal plan with entries from yesterday and today
    const mealPlan: IMealPlan = [
      {
        date: yesterday,
        plan: [
          {
            recipeId,
            components: [
              {
                componentId,
                servings: 1,
              },
            ],
          },
        ],
      },
      {
        date: todayTimestamp,
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
    ];

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
    const result = (await response.json()) as GetMealPlanResponse;

    // Should have 21 entries (1 week past + 2 weeks future)
    expect(result.length).toBe(21);

    // Yesterday should be in the results somewhere (it's within 1 week)
    expect(result.some((e) => e.date === yesterday)).toBe(true);

    // Today should also be in the results
    expect(result.some((e) => e.date === todayTimestamp)).toBe(true);
  });

  test('should return 401 without valid JWT', async ({ dynamoClient }) => {
    const app = await createTestApp({ dynamoClient });

    const response = await app.request(
      new Request('http://localhost/kitchencalm/meal-plan', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
  });
});
