import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteRecipe } from './delete-recipe.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/dynamodb/utilities.js');
import {
  deleteRecipe as deleteRecipeFromDynamo,
  getMealPlanForUser,
  putMealPlanForUser,
} from '@core/dynamodb/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';
const recipeUuid = '550e8400-e29b-41d4-a716-446655440100';
const otherRecipeUuid = '550e8400-e29b-41d4-a716-446655440200';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('deleteRecipe handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return success with uuid on successful delete', async () => {
    vi.mocked(deleteRecipeFromDynamo).mockResolvedValue();
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);

    const result = await deleteRecipe(mockContext(), recipeUuid);

    expect(result).toEqual({ success: true, uuid: recipeUuid });
  });

  it('should pass dynamoClient.client, userId, and uuid to delete utility function', async () => {
    const mockClient = { client: { delete: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
    });
    vi.mocked(deleteRecipeFromDynamo).mockResolvedValue();
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);

    await deleteRecipe(c, recipeUuid);

    expect(deleteRecipeFromDynamo).toHaveBeenCalledWith(mockClient.client, validUserId, recipeUuid);
  });

  it('should remove deleted recipe from meal plan day', async () => {
    vi.mocked(deleteRecipeFromDynamo).mockResolvedValue();
    vi.mocked(getMealPlanForUser).mockResolvedValue([
      {
        date: 1234567890,
        plan: [
          { recipeId: recipeUuid as any, components: [] },
          { recipeId: otherRecipeUuid as any, components: [] },
        ],
      },
    ]);

    await deleteRecipe(mockContext(), recipeUuid);

    expect(putMealPlanForUser).toHaveBeenCalledWith(expect.anything(), validUserId, [
      {
        date: 1234567890,
        plan: [{ recipeId: otherRecipeUuid, components: [] }],
      },
    ]);
  });

  it('should remove day entries that become empty after removing recipe', async () => {
    vi.mocked(deleteRecipeFromDynamo).mockResolvedValue();
    vi.mocked(getMealPlanForUser).mockResolvedValue([
      {
        date: 1234567890,
        plan: [{ recipeId: recipeUuid as any, components: [] }],
      },
    ]);

    await deleteRecipe(mockContext(), recipeUuid);

    expect(putMealPlanForUser).toHaveBeenCalledWith(expect.anything(), validUserId, []);
  });

  it('should not update meal plan when recipe is not in meal plan', async () => {
    vi.mocked(deleteRecipeFromDynamo).mockResolvedValue();
    vi.mocked(getMealPlanForUser).mockResolvedValue([
      {
        date: 1234567890,
        plan: [{ recipeId: otherRecipeUuid as any, components: [] }],
      },
    ]);

    await deleteRecipe(mockContext(), recipeUuid);

    expect(putMealPlanForUser).not.toHaveBeenCalled();
  });

  it('should not update meal plan when meal plan is empty', async () => {
    vi.mocked(deleteRecipeFromDynamo).mockResolvedValue();
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);

    await deleteRecipe(mockContext(), recipeUuid);

    expect(putMealPlanForUser).not.toHaveBeenCalled();
  });

  it('should throw when DynamoDB delete fails', async () => {
    vi.mocked(deleteRecipeFromDynamo).mockRejectedValue(new Error('DynamoDB error'));

    await expect(deleteRecipe(mockContext(), recipeUuid)).rejects.toThrow('DynamoDB error');
  });

  it('should handle different user IDs', async () => {
    const differentUserId = '550e8400-e29b-41d4-a716-446655440001';
    vi.mocked(deleteRecipeFromDynamo).mockResolvedValue();
    vi.mocked(getMealPlanForUser).mockResolvedValue([]);

    const result = await deleteRecipe(mockContext(differentUserId), recipeUuid);

    expect(result).toEqual({ success: true, uuid: recipeUuid });
    expect(deleteRecipeFromDynamo).toHaveBeenCalledWith(
      expect.anything(),
      differentUserId,
      recipeUuid
    );
  });
});
