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
  test('should return meal plan entries for next 2 weeks when empty', async ({ dynamoClient }) => {
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

    // Should have 14 empty entries (2 weeks)
    expect(result.length).toBe(14);
    for (const entry of result) {
      expect(entry.plan).toEqual([]);
    }

    // Verify dates are consecutive starting from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    for (let i = 0; i < 14; i++) {
      expect(result[i].date).toBe(todayTimestamp + i * 24 * 60 * 60 * 1000);
    }
  });

  test('should return existing meal plan entries plus generated empty ones for 2 weeks', async ({
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

    // Create a meal plan with entries for today and day 5
    const mealPlan: IMealPlan = [
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

    // Should have 14 entries total
    expect(result.length).toBe(14);

    // Today should have the recipe
    expect(result[0].plan.length).toBe(1);
    expect(result[0].plan[0].recipeId).toBe(recipeId);

    // Days 1-4 should be empty
    for (let i = 1; i < 5; i++) {
      expect(result[i].plan).toEqual([]);
    }

    // Day 5 should have the recipe
    expect(result[5].plan.length).toBe(1);
    expect(result[5].plan[0].recipeId).toBe(recipeId);

    // Days 6-13 should be empty
    for (let i = 6; i < 14; i++) {
      expect(result[i].plan).toEqual([]);
    }
  });

  test('should filter out entries older than today', async ({ dynamoClient }) => {
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

    // Should have 14 entries (no yesterday)
    expect(result.length).toBe(14);

    // All dates should be >= today
    for (const entry of result) {
      expect(entry.date).toBeGreaterThanOrEqual(todayTimestamp);
    }

    // First entry should be today
    expect(result[0].date).toBe(todayTimestamp);
    expect(result[0].plan.length).toBe(1);
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
