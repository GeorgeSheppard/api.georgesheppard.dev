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

describe('getMealPlan handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty object when no meal plan exists', async () => {
    vi.mocked(getMealPlanForUser).mockResolvedValue({});

    const result = await getMealPlan(mockContext());

    expect(result).toEqual({});
  });

  it('should return meal plan with entries', async () => {
    const mealPlan: IMealPlan = {
      'Monday - 01/08/2024': {
        'recipe-uuid-1': [{ componentId: 'comp-1', servings: 2 }],
      },
    };
    vi.mocked(getMealPlanForUser).mockResolvedValue(mealPlan);

    const result = await getMealPlan(mockContext());

    expect(result).toEqual(mealPlan);
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

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getMealPlanForUser).mockRejectedValue(new Error('DynamoDB error'));

    await expect(getMealPlan(mockContext())).rejects.toThrow('DynamoDB error');
  });
});
