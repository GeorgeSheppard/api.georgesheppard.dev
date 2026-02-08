import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteRecipe } from './delete-recipe.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/dynamodb/utilities.js');
import { deleteRecipe as deleteRecipeFromDynamo } from '@core/dynamodb/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';
const recipeUuid = '550e8400-e29b-41d4-a716-446655440100';

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

    const result = await deleteRecipe(mockContext(), recipeUuid);

    expect(result).toEqual({ success: true, uuid: recipeUuid });
  });

  it('should pass dynamoClient.client, userId, and uuid to utility function', async () => {
    const mockClient = { client: { delete: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
    });
    vi.mocked(deleteRecipeFromDynamo).mockResolvedValue();

    await deleteRecipe(c, recipeUuid);

    expect(deleteRecipeFromDynamo).toHaveBeenCalledWith(mockClient.client, validUserId, recipeUuid);
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(deleteRecipeFromDynamo).mockRejectedValue(new Error('DynamoDB error'));

    await expect(deleteRecipe(mockContext(), recipeUuid)).rejects.toThrow('DynamoDB error');
  });

  it('should handle different user IDs', async () => {
    const differentUserId = '550e8400-e29b-41d4-a716-446655440001';
    vi.mocked(deleteRecipeFromDynamo).mockResolvedValue();

    const result = await deleteRecipe(mockContext(differentUserId), recipeUuid);

    expect(result).toEqual({ success: true, uuid: recipeUuid });
    expect(deleteRecipeFromDynamo).toHaveBeenCalledWith(
      expect.anything(),
      differentUserId,
      recipeUuid
    );
  });
});
