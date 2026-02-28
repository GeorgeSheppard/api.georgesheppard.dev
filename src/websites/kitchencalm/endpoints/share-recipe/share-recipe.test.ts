import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shareRecipe } from './share-recipe.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import type { IRecipe } from '@core/types/recipes.js';

vi.mock('@core/dynamodb/shared-recipes.js');
import { createSharedRecipe } from '@core/dynamodb/shared-recipes.js';

const mockRecipe: IRecipe = {
  uuid: 'recipe-uuid-1',
  name: 'Pasta Carbonara',
  description: 'Classic Italian pasta',
  images: [],
  components: [],
};

function mockContext() {
  return createMockContext<ContextWithUserId>({
    dynamoClient: { client: {} },
  });
}

describe('shareRecipe handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return shareId on success', async () => {
    vi.mocked(createSharedRecipe).mockResolvedValue({ shareId: 'share-uuid-123' });

    const result = await shareRecipe(mockContext(), mockRecipe);

    expect(result).toEqual({ shareId: 'share-uuid-123' });
  });

  it('should pass dynamoClient.client and recipe to utility function', async () => {
    const mockClient = { client: { put: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      dynamoClient: mockClient,
    });
    vi.mocked(createSharedRecipe).mockResolvedValue({ shareId: 'share-1' });

    await shareRecipe(c, mockRecipe);

    expect(createSharedRecipe).toHaveBeenCalledWith(mockClient.client, mockRecipe);
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(createSharedRecipe).mockRejectedValue(new Error('DynamoDB error'));

    await expect(shareRecipe(mockContext(), mockRecipe)).rejects.toThrow('DynamoDB error');
  });
});
