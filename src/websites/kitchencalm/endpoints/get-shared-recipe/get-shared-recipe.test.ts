import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSharedRecipe } from './get-shared-recipe.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import type { IRecipe } from '@core/types/recipes.js';

vi.mock('@core/dynamodb/shared-recipes.js');
import { getSharedRecipe as getSharedRecipeFromDynamo } from '@core/dynamodb/shared-recipes.js';

const mockRecipe: IRecipe = {
  uuid: 'recipe-uuid-1',
  name: 'Pasta Carbonara',
  description: 'Classic Italian pasta',
  components: [],
};

function mockContext() {
  return createMockContext<ContextWithUserId>({
    dynamoClient: { client: {} },
  });
}

describe('getSharedRecipe handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return recipe when found', async () => {
    vi.mocked(getSharedRecipeFromDynamo).mockResolvedValue(mockRecipe);

    const result = await getSharedRecipe(mockContext(), 'share-id-123');

    expect(result).toEqual(mockRecipe);
  });

  it('should return null when recipe not found', async () => {
    vi.mocked(getSharedRecipeFromDynamo).mockResolvedValue(null);

    const result = await getSharedRecipe(mockContext(), 'non-existent-id');

    expect(result).toBeNull();
  });

  it('should pass dynamoClient.client and shareId to utility function', async () => {
    const mockClient = { client: { get: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      dynamoClient: mockClient,
    });
    vi.mocked(getSharedRecipeFromDynamo).mockResolvedValue(null);

    await getSharedRecipe(c, 'share-id-456');

    expect(getSharedRecipeFromDynamo).toHaveBeenCalledWith(mockClient.client, 'share-id-456');
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getSharedRecipeFromDynamo).mockRejectedValue(new Error('DynamoDB error'));

    await expect(getSharedRecipe(mockContext(), 'share-id')).rejects.toThrow('DynamoDB error');
  });
});
