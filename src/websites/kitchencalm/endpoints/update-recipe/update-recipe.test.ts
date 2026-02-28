import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateRecipe, UpdateRecipeRequest } from './update-recipe.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';

vi.mock('@core/dynamodb/utilities.js');
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'generated-uuid-1234'),
}));

import { updateRecipe as updateRecipeInDynamo } from '@core/dynamodb/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('updateRecipe handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use provided uuid when given', async () => {
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();

    const recipe: UpdateRecipeRequest = {
      uuid: 'existing-uuid',
      name: 'Pasta',
      description: 'Classic pasta',
      components: [],
    };

    const result = await updateRecipe(mockContext(), recipe);

    expect(result).toEqual({ uuid: 'existing-uuid', success: true });
  });

  it('should generate uuid when not provided', async () => {
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();

    const recipe: UpdateRecipeRequest = {
      name: 'New Recipe',
      description: 'A brand new recipe',
      components: [],
    };

    const result = await updateRecipe(mockContext(), recipe);

    expect(result).toEqual({ uuid: 'generated-uuid-1234', success: true });
  });

  it('should pass recipe with image to DynamoDB utility with server-generated timestamp', async () => {
    const mockClient = { client: { put: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
    });
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const recipe: UpdateRecipeRequest = {
      uuid: 'recipe-uuid',
      name: 'Pasta',
      description: 'Classic pasta',
      image: 'user/image.jpg',
      components: [],
    };

    await updateRecipe(c, recipe);

    expect(updateRecipeInDynamo).toHaveBeenCalledWith(mockClient.client, validUserId, {
      uuid: 'recipe-uuid',
      name: 'Pasta',
      description: 'Classic pasta',
      image: { key: 'user/image.jpg', timestamp: 1700000000000 },
      components: [],
    });
  });

  it('should pass recipe without image to DynamoDB when no image provided', async () => {
    const mockClient = { client: { put: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
    });
    vi.mocked(updateRecipeInDynamo).mockResolvedValue();

    const recipe: UpdateRecipeRequest = {
      uuid: 'recipe-uuid',
      name: 'Pasta',
      description: 'Classic pasta',
      components: [],
    };

    await updateRecipe(c, recipe);

    expect(updateRecipeInDynamo).toHaveBeenCalledWith(mockClient.client, validUserId, {
      uuid: 'recipe-uuid',
      name: 'Pasta',
      description: 'Classic pasta',
      image: undefined,
      components: [],
    });
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(updateRecipeInDynamo).mockRejectedValue(new Error('DynamoDB error'));

    const recipe: UpdateRecipeRequest = {
      name: 'Recipe',
      description: 'desc',
      components: [],
    };

    await expect(updateRecipe(mockContext(), recipe)).rejects.toThrow('DynamoDB error');
  });
});
