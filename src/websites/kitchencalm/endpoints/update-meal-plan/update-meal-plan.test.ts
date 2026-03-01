import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateMealPlan, UpdateMealPlanRequest } from './update-meal-plan.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/dynamodb/utilities.js');
import { putMealPlanForUser } from '@core/dynamodb/utilities.js';

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

describe('updateMealPlan handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save meal plan to DynamoDB', async () => {
    vi.mocked(putMealPlanForUser).mockResolvedValue();

    const today = getTodayTimestamp();
    const mealPlan: UpdateMealPlanRequest = [
      {
        date: today,
        plan: [
          {
            recipeId: 'recipe-uuid-1',
            components: [{ componentId: 'comp-1', servings: 2 }],
          },
        ],
      },
      {
        date: today + 24 * 60 * 60 * 1000,
        plan: [
          {
            recipeId: 'recipe-uuid-2',
            components: [{ componentId: 'comp-2', servings: 3 }],
          },
        ],
      },
    ];

    const result = await updateMealPlan(mockContext(), mealPlan);

    expect(result.success).toBe(true);
    expect(putMealPlanForUser).toHaveBeenCalledWith(expect.anything(), validUserId, mealPlan);
  });

  it('should sort meal plan by date before saving', async () => {
    vi.mocked(putMealPlanForUser).mockResolvedValue();

    const today = getTodayTimestamp();
    // Create unsorted meal plan
    const mealPlan: UpdateMealPlanRequest = [
      {
        date: today + 24 * 60 * 60 * 1000,
        plan: [
          {
            recipeId: 'recipe-uuid-2',
            components: [{ componentId: 'comp-2', servings: 1 }],
          },
        ],
      },
      {
        date: today,
        plan: [
          {
            recipeId: 'recipe-uuid-1',
            components: [{ componentId: 'comp-1', servings: 1 }],
          },
        ],
      },
    ];

    await updateMealPlan(mockContext(), mealPlan);

    // Verify that the saved meal plan is sorted
    const savedMealPlan = vi.mocked(putMealPlanForUser).mock.calls[0][2];
    expect(savedMealPlan[0].date).toBeLessThan(savedMealPlan[1].date);
  });

  it('should accept empty meal plan', async () => {
    vi.mocked(putMealPlanForUser).mockResolvedValue();

    const mealPlan: UpdateMealPlanRequest = [];

    const result = await updateMealPlan(mockContext(), mealPlan);

    expect(result.success).toBe(true);
    expect(putMealPlanForUser).toHaveBeenCalledWith(expect.anything(), validUserId, []);
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(putMealPlanForUser).mockRejectedValue(new Error('DynamoDB error'));

    const today = getTodayTimestamp();
    const mealPlan: UpdateMealPlanRequest = [
      {
        date: today,
        plan: [],
      },
    ];

    await expect(updateMealPlan(mockContext(), mealPlan)).rejects.toThrow(
      'Failed to update meal plan'
    );
  });
});
