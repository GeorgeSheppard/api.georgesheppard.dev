import { describe, it, expect } from 'vitest';
import {
  transformRecipeForSearch,
  searchRecipes,
  parseSearchFields,
} from './search-recipes-util.js';
import type { IRecipe } from '@core/types/recipes.js';
import { Unit } from '@core/types/recipes.js';

function makeRecipe(overrides: { uuid: string; name: string } & Partial<IRecipe>): IRecipe {
  return {
    description: '',
    images: [],
    components: [],
    ...overrides,
    uuid: overrides.uuid as any,
  };
}

describe('transformRecipeForSearch', () => {
  it('should flatten ingredients from multiple components', () => {
    const recipe = makeRecipe({
      uuid: 'r1',
      name: 'Test',
      components: [
        {
          uuid: 'c1' as any,
          name: 'Main',
          ingredients: [
            { name: 'Flour', quantity: { unit: Unit.CUP, value: 2 } },
            { name: 'Eggs', quantity: { unit: Unit.NUMBER, value: 3 } },
          ],
          instructions: [],
        },
        {
          uuid: 'c2' as any,
          name: 'Topping',
          ingredients: [{ name: 'Sugar', quantity: { unit: Unit.TABLESPOON, value: 1 } }],
          instructions: [],
        },
      ],
    });

    const result = transformRecipeForSearch(recipe);

    expect(result.ingredients).toEqual(['Flour', 'Eggs', 'Sugar']);
  });

  it('should flatten instructions from multiple components', () => {
    const recipe = makeRecipe({
      uuid: 'r1',
      name: 'Test',
      components: [
        {
          uuid: 'c1' as any,
          name: 'Main',
          ingredients: [],
          instructions: [{ text: 'Step 1' }, { text: 'Step 2' }],
        },
        {
          uuid: 'c2' as any,
          name: 'Sauce',
          ingredients: [],
          instructions: [{ text: 'Simmer for 5 minutes' }],
        },
      ],
    });

    const result = transformRecipeForSearch(recipe);

    expect(result.instructions).toEqual(['Step 1', 'Step 2', 'Simmer for 5 minutes']);
  });

  it('should return empty arrays for recipe with no components', () => {
    const result = transformRecipeForSearch(makeRecipe({ uuid: 'r1', name: 'Simple' }));

    expect(result.ingredients).toEqual([]);
    expect(result.instructions).toEqual([]);
  });

  it('should preserve uuid, name, and description', () => {
    const recipe = makeRecipe({ uuid: 'r1', name: 'Pasta', description: 'Italian dish' });

    const result = transformRecipeForSearch(recipe);

    expect(result.uuid).toBe('r1');
    expect(result.name).toBe('Pasta');
    expect(result.description).toBe('Italian dish');
  });
});

describe('searchRecipes', () => {
  const pasta = makeRecipe({ uuid: 'r1', name: 'Pasta Carbonara', description: 'Italian pasta' });
  const soup = makeRecipe({ uuid: 'r2', name: 'Tomato Soup', description: 'Warm comforting soup' });
  const salad = makeRecipe({
    uuid: 'r3',
    name: 'Caesar Salad',
    description: 'Classic salad',
    components: [
      {
        uuid: 'c1' as any,
        name: 'Main',
        ingredients: [{ name: 'Bacon', quantity: { unit: Unit.GRAM, value: 100 } }],
        instructions: [{ text: 'Preheat oven then bake bacon' }],
      },
    ],
  });

  it('should return empty array for empty recipe list', () => {
    expect(searchRecipes([], 'pasta')).toEqual([]);
  });

  it('should match by name', () => {
    const result = searchRecipes([pasta, soup], 'Pasta');

    expect(result).toContain('r1');
    expect(result).not.toContain('r2');
  });

  it('should match by description', () => {
    const result = searchRecipes([pasta, soup], 'Italian', ['description']);

    expect(result).toContain('r1');
    expect(result).not.toContain('r2');
  });

  it('should match by ingredient name', () => {
    const result = searchRecipes([pasta, soup, salad], 'Bacon', ['ingredients']);

    expect(result).toContain('r3');
    expect(result).not.toContain('r1');
    expect(result).not.toContain('r2');
  });

  it('should match by instruction text', () => {
    const result = searchRecipes([pasta, soup, salad], 'Preheat', ['instructions']);

    expect(result).toContain('r3');
    expect(result).not.toContain('r1');
  });

  it('should return no results when query matches nothing', () => {
    const result = searchRecipes([pasta, soup], 'XYZ123nonexistent');

    expect(result).toHaveLength(0);
  });

  it('should limit search to specified fields', () => {
    // "Warm" only appears in soup description — name-only search should not match
    const result = searchRecipes([pasta, soup], 'Warm', ['name']);

    expect(result).not.toContain('r2');
  });

  it('should be case-insensitive', () => {
    const result = searchRecipes([pasta, soup], 'pasta');

    expect(result).toContain('r1');
  });

  it('should return multiple matching results', () => {
    const pasta2 = makeRecipe({ uuid: 'r4', name: 'Pasta Alfredo', description: '' });
    const result = searchRecipes([pasta, soup, pasta2], 'Pasta');

    expect(result).toContain('r1');
    expect(result).toContain('r4');
    expect(result).not.toContain('r2');
  });

  it('should not return duplicates', () => {
    // Recipe where query matches both name and description
    const recipe = makeRecipe({
      uuid: 'r1',
      name: 'Pasta Carbonara',
      description: 'A pasta dish',
    });
    const result = searchRecipes([recipe], 'Pasta');

    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });
});

describe('parseSearchFields', () => {
  it('should return undefined when given undefined', () => {
    expect(parseSearchFields(undefined)).toBeUndefined();
  });

  it('should parse a single valid field', () => {
    expect(parseSearchFields('name')).toEqual(['name']);
  });

  it('should parse comma-separated fields', () => {
    expect(parseSearchFields('name,description')).toEqual(['name', 'description']);
  });

  it('should filter out invalid field names', () => {
    expect(parseSearchFields('name,invalid,description')).toEqual(['name', 'description']);
  });

  it('should trim whitespace from each field', () => {
    expect(parseSearchFields('name, description')).toEqual(['name', 'description']);
  });

  it('should return empty array when all fields are invalid', () => {
    expect(parseSearchFields('foo,bar')).toEqual([]);
  });

  it('should accept all valid fields', () => {
    expect(parseSearchFields('name,description,ingredients,instructions')).toEqual([
      'name',
      'description',
      'ingredients',
      'instructions',
    ]);
  });
});
