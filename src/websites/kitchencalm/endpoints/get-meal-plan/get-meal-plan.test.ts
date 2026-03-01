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

  it('should return empty array when no meal plan exists, but still generate next 2 weeks', async () => {
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);

    const result = await getMealPlan(mockContext());

    expect(result.length).toBe(14);
    expect(result[0].plan).toEqual([]);
    expect(result[13].plan).toEqual([]);

    // Verify dates are consecutive starting from today
    const today = getTodayTimestamp();
    for (let i = 0; i < 14; i++) {
      expect(result[i].date).toBe(today + i * 24 * 60 * 60 * 1000);
    }
  });

  it('should filter out entries older than today', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const yesterday = todayTimestamp - 24 * 60 * 60 * 1000;
    const tomorrow = todayTimestamp + 24 * 60 * 60 * 1000;

    const mealPlan: IMealPlan = [
      {
        date: yesterday,
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
      {
        date: tomorrow,
        plan: [
          {
            recipeId: 'recipe-tomorrow',
            components: [{ componentId: 'comp-tomorrow', servings: 3 }],
          },
        ],
      },
    ];

    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);

    const result = await getMealPlan(mockContext());

    // Should not include yesterday, should include today and tomorrow + rest of 2 weeks
    expect(result.some((e) => e.date === yesterday)).toBe(false);
    expect(result.some((e) => e.date === todayTimestamp)).toBe(true);
    expect(result.some((e) => e.date === tomorrow)).toBe(true);
    expect(result.length).toBe(14);
  });

  it('should generate empty entries for missing days in the next 2 weeks', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    // Only have entries for today and day 5
    const mealPlan: IMealPlan = [
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
        date: todayTimestamp + 5 * 24 * 60 * 60 * 1000,
        plan: [
          {
            recipeId: 'recipe-6',
            components: [{ componentId: 'comp-6', servings: 1 }],
          },
        ],
      },
    ];

    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);

    const result = await getMealPlan(mockContext());

    expect(result.length).toBe(14);
    // Check that day 1 has content but days 2-5 are empty
    expect(result[0].plan.length).toBeGreaterThan(0);
    expect(result[1].plan).toEqual([]);
    expect(result[2].plan).toEqual([]);
    expect(result[3].plan).toEqual([]);
    expect(result[4].plan).toEqual([]);
    // Check that day 5 has content
    expect(result[5].plan.length).toBeGreaterThan(0);
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
