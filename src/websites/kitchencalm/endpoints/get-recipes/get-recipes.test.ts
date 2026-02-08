import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRecipes } from './get-recipes.js';
import { createMockContext } from '@test/utils/mock-context.js';
import type { ContextWithUserId } from '@core/types/context.js';
import type { IRecipe } from '@core/types/recipes.js';
import { Unit } from '@core/types/recipes.js';

vi.mock('@core/dynamodb/utilities.js');
import { getAllRecipesForUser } from '@core/dynamodb/utilities.js';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';

function mockContext(userId = validUserId) {
  return createMockContext<ContextWithUserId>({
    userId,
    dynamoClient: { client: {} },
  });
}

describe('getRecipes handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty object when user has no recipes', async () => {
    vi.mocked(getAllRecipesForUser).mockResolvedValue([]);

    const result = await getRecipes(mockContext());

    expect(result).toEqual({});
  });

  it('should return recipes mapped by uuid', async () => {
    const recipe: IRecipe = {
      uuid: 'recipe-1',
      name: 'Pasta Carbonara',
      description: 'Classic Italian pasta',
      images: [],
      components: [],
    };
    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);

    const result = await getRecipes(mockContext());

    expect(result).toEqual({ 'recipe-1': recipe });
  });

  it('should map multiple recipes by uuid', async () => {
    const recipes: IRecipe[] = [
      { uuid: 'recipe-1', name: 'Pasta', description: 'desc', images: [], components: [] },
      { uuid: 'recipe-2', name: 'Pizza', description: 'desc', images: [], components: [] },
    ];
    vi.mocked(getAllRecipesForUser).mockResolvedValue(recipes);

    const result = await getRecipes(mockContext());

    expect(result).toEqual({
      'recipe-1': recipes[0],
      'recipe-2': recipes[1],
    });
  });

  it('should preserve full recipe structure including components', async () => {
    const recipe: IRecipe = {
      uuid: 'recipe-1',
      name: 'Test Recipe',
      description: 'A test recipe',
      images: [{ timestamp: 1234567890, key: 'user/image.jpg' }],
      components: [
        {
          uuid: 'comp-1',
          name: 'Main',
          ingredients: [{ name: 'Flour', quantity: { unit: Unit.CUP, value: 2 } }],
          instructions: [{ text: 'Mix ingredients' }],
        },
      ],
    };
    vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);

    const result = await getRecipes(mockContext());

    expect(result['recipe-1']).toEqual(recipe);
    expect(result['recipe-1'].components[0].ingredients[0].quantity.unit).toBe(Unit.CUP);
  });

  it('should pass dynamoClient.client and userId to utility function', async () => {
    const mockClient = { client: { query: 'mock' } };
    const c = createMockContext<ContextWithUserId>({
      userId: validUserId,
      dynamoClient: mockClient,
    });
    vi.mocked(getAllRecipesForUser).mockResolvedValue([]);

    await getRecipes(c);

    expect(getAllRecipesForUser).toHaveBeenCalledWith(mockClient.client, validUserId);
  });

  it('should use correct userId for different users', async () => {
    const differentUserId = '550e8400-e29b-41d4-a716-446655440001';
    vi.mocked(getAllRecipesForUser).mockResolvedValue([]);

    await getRecipes(mockContext(differentUserId));

    expect(getAllRecipesForUser).toHaveBeenCalledWith(expect.anything(), differentUserId);
  });

  it('should throw when DynamoDB fails', async () => {
    vi.mocked(getAllRecipesForUser).mockRejectedValue(new Error('DynamoDB error'));

    await expect(getRecipes(mockContext())).rejects.toThrow('DynamoDB error');
  });
});
