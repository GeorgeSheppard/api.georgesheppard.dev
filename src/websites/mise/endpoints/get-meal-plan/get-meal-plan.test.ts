import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMealPlan } from './get-meal-plan.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import type { IMealPlan } from '@core/types/meal-plan.js';

vi.mock('@core/dynamodb/utilities.js');
import { getMealPlanForUser } from '@core/dynamodb/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

function getTodayTimestamp(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

describe('getMealPlan handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no meal plan exists, but still generate 1 week past to 2 weeks future', async () => {
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);

    const result = await getMealPlan(mockContext());

    // 1 week past + today + 2 weeks future = 21 days
    expect(result.length).toBe(21);
    expect(result[0].plan).toEqual([]);
    expect(result[20].plan).toEqual([]);

    // Verify dates are consecutive starting from 7 days ago
    const today = getTodayTimestamp();
    const oneWeekAgo = today - 7 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 21; i++) {
      expect(result[i].date).toBe(oneWeekAgo + i * 24 * 60 * 60 * 1000);
    }
  });

  it('should keep historical entries within 1 week and add future entries for 2-week window', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const oneWeekAgo = todayTimestamp - 7 * 24 * 60 * 60 * 1000;

    const mealPlan: IMealPlan = [
      {
        date: oneWeekAgo,
        plan: [{ recipeId: 'recipe-old', components: [{ componentId: 'comp-old', servings: 1 }] }],
      },
      {
        date: todayTimestamp,
        plan: [
          {
            recipeId: 'recipe-today',
            components: [{ componentId: 'comp-today', servings: 2 }],
          },
        ],
      },
    ];

    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);

    const result = await getMealPlan(mockContext());

    // Should keep 1 week of history and generate forward 2 weeks
    expect(result.some((e) => e.date === oneWeekAgo)).toBe(true);
    expect(result.some((e) => e.date === todayTimestamp)).toBe(true);
    expect(result.length).toBe(21); // 1 week past + 2 weeks future
  });

  it('should generate empty entries for missing days and keep 1 week past', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const oneWeekAgo = todayTimestamp - 7 * 24 * 60 * 60 * 1000;

    // Only have entries for a few days
    const mealPlan: IMealPlan = [
      {
        date: oneWeekAgo,
        plan: [
          {
            recipeId: 'recipe-past',
            components: [{ componentId: 'comp-past', servings: 1 }],
          },
        ],
      },
      {
        date: todayTimestamp,
        plan: [
          {
            recipeId: 'recipe-1',
            components: [{ componentId: 'comp-1', servings: 1 }],
          },
        ],
      },
    ];

    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);

    const result = await getMealPlan(mockContext());

    // 1 week past + 2 weeks future = 21 days
    expect(result.length).toBe(21);
    // First day should be from 1 week ago
    expect(result[0].date).toBe(oneWeekAgo);
    expect(result[0].plan.length).toBeGreaterThan(0);
    // Day at index 7 should be today
    expect(result[7].date).toBe(todayTimestamp);
    expect(result[7].plan.length).toBeGreaterThan(0);
  });

  it('should return array sorted by date', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    // Create entries in reverse order
    const mealPlan: IMealPlan = [
      {
        date: todayTimestamp + 2 * 24 * 60 * 60 * 1000,
        plan: [
          {
            recipeId: 'recipe-3',
            components: [{ componentId: 'comp-3', servings: 1 }],
          },
        ],
      },
      {
        date: todayTimestamp,
        plan: [
          {
            recipeId: 'recipe-1',
            components: [{ componentId: 'comp-1', servings: 1 }],
          },
        ],
      },
      {
        date: todayTimestamp + 1 * 24 * 60 * 60 * 1000,
        plan: [
          {
            recipeId: 'recipe-2',
            components: [{ componentId: 'comp-2', servings: 1 }],
          },
        ],
      },
    ];

    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);

    const result = await getMealPlan(mockContext());

    // Verify sorting
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].date).toBeLessThanOrEqual(result[i + 1].date);
    }
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getMealPlanForUser).mockRejectedValue(new Error('DynamoDB error'));

    await expect(getMealPlan(mockContext())).rejects.toThrow('Failed to fetch meal plan');
  });
});
