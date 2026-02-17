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

describe('updateMealPlan handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return success on update', async () => {
    vi.mocked(putMealPlanForUser).mockResolvedValue();

    const mealPlan: UpdateMealPlanRequest = [
      {
        date: 'Monday - 01/08/2024',
        plan: {
          'recipe-uuid-1': [{ componentId: 'comp-1', servings: 2 }],
        },
      },
    ];

    const result = await updateMealPlan(mockContext(), mealPlan);

    expect(result).toEqual({ success: true });
  });

  it('should pass dynamoClient.client, userId, and meal plan to utility function', async () => {
    const mockClient = { client: { put: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
    });
    vi.mocked(putMealPlanForUser).mockResolvedValue();

    const mealPlanArray: UpdateMealPlanRequest = [
      {
        date: 'Tuesday - 01/09/2024',
        plan: {
          'recipe-uuid-2': [{ componentId: 'comp-2', servings: 4 }],
        },
      },
    ];

    await updateMealPlan(c, mealPlanArray);

    const expectedMealPlan = {
      'Tuesday - 01/09/2024': {
        'recipe-uuid-2': [{ componentId: 'comp-2', servings: 4 }],
      },
    };
    expect(putMealPlanForUser).toHaveBeenCalledWith(
      mockClient.client,
      validUserId,
      expectedMealPlan
    );
  });

  it('should handle empty meal plan', async () => {
    vi.mocked(putMealPlanForUser).mockResolvedValue();

    const result = await updateMealPlan(mockContext(), []);

    expect(result).toEqual({ success: true });
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(putMealPlanForUser).mockRejectedValue(new Error('DynamoDB error'));

    await expect(updateMealPlan(mockContext(), [])).rejects.toThrow('DynamoDB error');
  });
});
