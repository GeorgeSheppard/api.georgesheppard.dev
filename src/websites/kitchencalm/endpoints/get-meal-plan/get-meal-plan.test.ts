import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMealPlan } from './get-meal-plan.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import type { IMealPlan } from '@core/types/meal-plan.js';

vi.mock('@core/dynamodb/utilities.js');
import { getMealPlanForUser, putMealPlanForUser } from '@core/dynamodb/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('getMealPlan handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no meal plan exists', async () => {
    vi.mocked(getMealPlanForUser).mockResolvedValue({});

    const result = await getMealPlan(mockContext());

    expect(result).toEqual([]);
  });

  it('should return meal plan with entries as sorted array', async () => {
    const today = new Date();
    const dateStr = `Monday - ${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    const mealPlan: IMealPlan = {
      [dateStr]: {
        'recipe-uuid-1': [{ componentId: 'comp-1', servings: 2 }],
      },
    };
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);

    const result = await getMealPlan(mockContext());

    expect(result).toEqual([
      {
        date: dateStr,
        plan: {
          'recipe-uuid-1': [{ componentId: 'comp-1', servings: 2 }],
        },
      },
    ]);
    expect(putMealPlanForUser).not.toHaveBeenCalled();
  });

  it('should pass dynamoClient.client and userId to utility function', async () => {
    const mockClient = { client: { get: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
    });
    vi.mocked(getMealPlanForUser).mockResolvedValue({});

    await getMealPlan(c);

    expect(getMealPlanForUser).toHaveBeenCalledWith(mockClient.client, validUserId);
  });

  it('should sort meal plan entries by date', async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const todayStr = `Monday - ${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const tomorrowStr = `Tuesday - ${String(tomorrow.getDate()).padStart(2, '0')}/${String(tomorrow.getMonth() + 1).padStart(2, '0')}/${tomorrow.getFullYear()}`;
    const dayAfterStr = `Wednesday - ${String(dayAfter.getDate()).padStart(2, '0')}/${String(dayAfter.getMonth() + 1).padStart(2, '0')}/${dayAfter.getFullYear()}`;

    const mealPlan: IMealPlan = {
      [dayAfterStr]: {
        'recipe-uuid-3': [{ componentId: 'comp-3', servings: 1 }],
      },
      [todayStr]: {
        'recipe-uuid-1': [{ componentId: 'comp-1', servings: 2 }],
      },
      [tomorrowStr]: {
        'recipe-uuid-2': [{ componentId: 'comp-2', servings: 3 }],
      },
    };
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);

    const result = await getMealPlan(mockContext());

    expect(result).toEqual([
      {
        date: todayStr,
        plan: {
          'recipe-uuid-1': [{ componentId: 'comp-1', servings: 2 }],
        },
      },
      {
        date: tomorrowStr,
        plan: {
          'recipe-uuid-2': [{ componentId: 'comp-2', servings: 3 }],
        },
      },
      {
        date: dayAfterStr,
        plan: {
          'recipe-uuid-3': [{ componentId: 'comp-3', servings: 1 }],
        },
      },
    ]);
  });

  it('should update stale meal plan dates and save to DynamoDB', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Create dates from 30 days ago
    const oldDate1 = new Date(today);
    oldDate1.setDate(oldDate1.getDate() - 30);
    const oldDate2 = new Date(today);
    oldDate2.setDate(oldDate2.getDate() - 29);

    const oldDateStr1 = `Monday - ${String(oldDate1.getDate()).padStart(2, '0')}/${String(oldDate1.getMonth() + 1).padStart(2, '0')}/${oldDate1.getFullYear()}`;
    const oldDateStr2 = `Tuesday - ${String(oldDate2.getDate()).padStart(2, '0')}/${String(oldDate2.getMonth() + 1).padStart(2, '0')}/${oldDate2.getFullYear()}`;

    const oldMealPlan: IMealPlan = {
      [oldDateStr1]: {
        'recipe-uuid-1': [{ componentId: 'comp-1', servings: 2 }],
      },
      [oldDateStr2]: {
        'recipe-uuid-2': [{ componentId: 'comp-2', servings: 3 }],
      },
    };

    vi.mocked(getMealPlanForUser).mockResolvedValue(oldMealPlan);

    const result = await getMealPlan(mockContext());

    // Should have updated the dates in DynamoDB
    expect(putMealPlanForUser).toHaveBeenCalled();

    // The result should have updated dates with earliest date shifted to 7 days ago
    expect(result.length).toBe(2);
    const resultDates = result.map((entry) => entry.date);
    for (const dateStr of resultDates) {
      const parts = dateStr.split(' - ');
      const [day, month, year] = parts[1].split('/').map(Number);
      const resultDate = new Date(year, month - 1, day);
      resultDate.setHours(0, 0, 0, 0);

      // Result dates should be within 1 week of past to present (7 days ago to today)
      const daysDiff = (resultDate.getTime() - sevenDaysAgo.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThanOrEqual(0); // At or after 7 days ago
      expect(daysDiff).toBeLessThanOrEqual(8); // Within the historical range
    }
  });

  it('should not update recent meal plan dates', async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = `Monday - ${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const tomorrowStr = `Tuesday - ${String(tomorrow.getDate()).padStart(2, '0')}/${String(tomorrow.getMonth() + 1).padStart(2, '0')}/${tomorrow.getFullYear()}`;

    const recentMealPlan: IMealPlan = {
      [todayStr]: {
        'recipe-uuid-1': [{ componentId: 'comp-1', servings: 2 }],
      },
      [tomorrowStr]: {
        'recipe-uuid-2': [{ componentId: 'comp-2', servings: 3 }],
      },
    };

    vi.mocked(getMealPlanForUser).mockResolvedValue(recentMealPlan);

    const result = await getMealPlan(mockContext());

    // Should not update dates or save to DynamoDB
    expect(putMealPlanForUser).not.toHaveBeenCalled();
    expect(result.length).toBe(2);
    expect(result[0].date).toBe(todayStr);
    expect(result[1].date).toBe(tomorrowStr);
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getMealPlanForUser).mockRejectedValue(new Error('DynamoDB error'));

    await expect(getMealPlan(mockContext())).rejects.toThrow('DynamoDB error');
  });
});
