import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchRecipesHandler } from './search-recipes.js';
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

const defaultInput = { q: 'pasta', fields: 'name,description,ingredients,instructions' };

describe('searchRecipesHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty results', () => {
    it('should return empty results when user has no recipes', async () => {
      vi.mocked(getAllRecipesForUser).mockResolvedValue([]);

      const result = await searchRecipesHandler(mockContext(), defaultInput);

      expect(result).toEqual({ results: [], count: 0 });
    });

    it('should return empty results when nothing matches the query', async () => {
      const recipe: IRecipe = {
        uuid: 'recipe-1' as any,
        name: 'Pasta Carbonara',
        description: 'Italian dish',
        images: [],
        components: [],
      };
      vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);

      const result = await searchRecipesHandler(mockContext(), {
        q: 'XYZ123nonexistent',
        fields: 'name',
      });

      expect(result).toEqual({ results: [], count: 0 });
    });
  });

  describe('matching results', () => {
    it('should return matching recipe by name', async () => {
      const recipe: IRecipe = {
        uuid: 'recipe-1' as any,
        name: 'Pasta Carbonara',
        description: 'Italian dish',
        images: [],
        components: [],
      };
      vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);

      const result = await searchRecipesHandler(mockContext(), { q: 'Pasta', fields: 'name' });

      expect(result.count).toBe(1);
      expect(result.results[0].name).toBe('Pasta Carbonara');
    });

    it('should return multiple matching results', async () => {
      const recipes: IRecipe[] = [
        {
          uuid: 'recipe-1' as any,
          name: 'Pasta Carbonara',
          description: '',
          images: [],
          components: [],
        },
        {
          uuid: 'recipe-2' as any,
          name: 'Pasta Alfredo',
          description: '',
          images: [],
          components: [],
        },
        { uuid: 'recipe-3' as any, name: 'Risotto', description: '', images: [], components: [] },
      ];
      vi.mocked(getAllRecipesForUser).mockResolvedValue(recipes);

      const result = await searchRecipesHandler(mockContext(), { q: 'Pasta', fields: 'name' });

      expect(result.count).toBe(2);
      const names = result.results.map((r) => r.name);
      expect(names).toContain('Pasta Carbonara');
      expect(names).toContain('Pasta Alfredo');
    });

    it('should match by ingredient', async () => {
      const recipe: IRecipe = {
        uuid: 'recipe-1' as any,
        name: 'Carbonara',
        description: '',
        images: [],
        components: [
          {
            uuid: 'comp-1' as any,
            name: 'Main',
            ingredients: [{ name: 'Bacon', quantity: { unit: Unit.GRAM, value: 200 } }],
            instructions: [],
          },
        ],
      };
      vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);

      const result = await searchRecipesHandler(mockContext(), {
        q: 'Bacon',
        fields: 'ingredients',
      });

      expect(result.count).toBe(1);
      expect(result.results[0].name).toBe('Carbonara');
    });
  });

  describe('response shape', () => {
    it('should return only uuid, name, description, and ingredients', async () => {
      const recipe: IRecipe = {
        uuid: 'recipe-1' as any,
        name: 'Pasta Carbonara',
        description: 'Italian dish',
        images: [{ timestamp: 123, key: 'img.jpg' }],
        components: [
          {
            uuid: 'comp-1' as any,
            name: 'Main',
            ingredients: [{ name: 'Spaghetti', quantity: { unit: Unit.GRAM, value: 400 } }],
            instructions: [{ text: 'Boil pasta' }],
          },
        ],
      };
      vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);

      const result = await searchRecipesHandler(mockContext(), { q: 'Pasta', fields: 'name' });

      expect(Object.keys(result.results[0]).sort()).toEqual(
        ['description', 'ingredients', 'name', 'uuid'].sort()
      );
    });

    it('should flatten ingredients from all components', async () => {
      const recipe: IRecipe = {
        uuid: 'recipe-1' as any,
        name: 'Pasta',
        description: '',
        images: [],
        components: [
          {
            uuid: 'comp-1' as any,
            name: 'Main',
            ingredients: [
              { name: 'Bacon', quantity: { unit: Unit.GRAM, value: 200 } },
              { name: 'Eggs', quantity: { unit: Unit.NUMBER, value: 3 } },
            ],
            instructions: [],
          },
          {
            uuid: 'comp-2' as any,
            name: 'Sauce',
            ingredients: [{ name: 'Parmesan', quantity: { unit: Unit.GRAM, value: 100 } }],
            instructions: [],
          },
        ],
      };
      vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);

      const result = await searchRecipesHandler(mockContext(), { q: 'Pasta', fields: 'name' });

      expect(result.results[0].ingredients).toEqual(['Bacon', 'Eggs', 'Parmesan']);
    });

    it('should not include images or raw component structure in results', async () => {
      const recipe: IRecipe = {
        uuid: 'recipe-1' as any,
        name: 'Pasta',
        description: '',
        images: [{ timestamp: 123, key: 'img.jpg' }],
        components: [
          {
            uuid: 'comp-1' as any,
            name: 'Main',
            ingredients: [],
            instructions: [{ text: 'Boil water' }],
          },
        ],
      };
      vi.mocked(getAllRecipesForUser).mockResolvedValue([recipe]);

      const result = await searchRecipesHandler(mockContext(), { q: 'Pasta', fields: 'name' });

      expect(result.results[0]).not.toHaveProperty('images');
      expect(result.results[0]).not.toHaveProperty('components');
    });
  });

  describe('dependency usage', () => {
    it('should pass correct userId and client to getAllRecipesForUser', async () => {
      const mockClient = { client: { send: vi.fn() } };
      const c = createMockContext<ContextWithUserId>({
        userId: validUserId,
        dynamoClient: mockClient,
      });
      vi.mocked(getAllRecipesForUser).mockResolvedValue([]);

      await searchRecipesHandler(c, defaultInput);

      expect(getAllRecipesForUser).toHaveBeenCalledWith(mockClient.client, validUserId);
    });

    it('should use correct userId for different users', async () => {
      const otherUserId = '550e8400-e29b-41d4-a716-446655440001';
      vi.mocked(getAllRecipesForUser).mockResolvedValue([]);

      await searchRecipesHandler(mockContext(otherUserId), defaultInput);

      expect(getAllRecipesForUser).toHaveBeenCalledWith(expect.anything(), otherUserId);
    });
  });

  describe('error handling', () => {
    it('should throw when DynamoDB fails', async () => {
      vi.mocked(getAllRecipesForUser).mockRejectedValue(new Error('DynamoDB connection error'));

      await expect(searchRecipesHandler(mockContext(), defaultInput)).rejects.toThrow(
        'DynamoDB connection error'
      );
    });
  });
});
