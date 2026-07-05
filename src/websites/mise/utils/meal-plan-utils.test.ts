import { describe, it, expect } from 'vitest';
import {
  addRecipeToMealPlan,
  removeRecipeFromMealPlan,
  parseMealPlanDate,
} from './meal-plan-utils.js';
import type { IMealPlan } from '@core/types/meal-plan.js';
import type { IRecipe } from '@core/types/recipes.js';

const recipe: IRecipe = {
  uuid: 'recipe-1',
  name: 'Chicken Curry',
  description: 'desc',
  images: [],
  components: [
    { uuid: 'comp-1', name: 'Main', ingredients: [], instructions: [], servings: 4 },
    { uuid: 'comp-2', name: 'Rice', ingredients: [], instructions: [] },
  ],
};

describe('parseMealPlanDate', () => {
  it('parses YYYY-MM-DD to a UTC-midnight timestamp', () => {
    expect(parseMealPlanDate('2026-07-05')).toBe(Date.UTC(2026, 6, 5));
  });

  it('throws on an invalid format', () => {
    expect(() => parseMealPlanDate('July 5th')).toThrow('Invalid date');
  });
});

describe('addRecipeToMealPlan', () => {
  it('creates a new day entry when the date has no entry', () => {
    const result = addRecipeToMealPlan([], recipe, 1000);

    expect(result).toEqual([
      {
        date: 1000,
        plan: [
          {
            recipeId: 'recipe-1',
            components: [
              { componentId: 'comp-1', servings: 4 },
              { componentId: 'comp-2', servings: 1 },
            ],
          },
        ],
      },
    ]);
  });

  it('uses the servings override for every component when provided', () => {
    const result = addRecipeToMealPlan([], recipe, 1000, 2);

    expect(result[0].plan[0].components).toEqual([
      { componentId: 'comp-1', servings: 2 },
      { componentId: 'comp-2', servings: 2 },
    ]);
  });

  it('adds the recipe to an existing day alongside other recipes', () => {
    const existing: IMealPlan = [
      { date: 1000, plan: [{ recipeId: 'other-recipe', components: [] }] },
    ];

    const result = addRecipeToMealPlan(existing, recipe, 1000);

    expect(result).toHaveLength(1);
    expect(result[0].plan.map((entry) => entry.recipeId)).toEqual(['other-recipe', 'recipe-1']);
  });

  it('replaces the components if the recipe is already planned for that day', () => {
    const existing: IMealPlan = [
      {
        date: 1000,
        plan: [{ recipeId: 'recipe-1', components: [{ componentId: 'comp-1', servings: 1 }] }],
      },
    ];

    const result = addRecipeToMealPlan(existing, recipe, 1000, 3);

    expect(result[0].plan).toEqual([
      {
        recipeId: 'recipe-1',
        components: [
          { componentId: 'comp-1', servings: 3 },
          { componentId: 'comp-2', servings: 3 },
        ],
      },
    ]);
  });

  it('leaves other days untouched', () => {
    const existing: IMealPlan = [{ date: 500, plan: [{ recipeId: 'other', components: [] }] }];

    const result = addRecipeToMealPlan(existing, recipe, 1000);

    expect(result.find((entry) => entry.date === 500)).toEqual(existing[0]);
  });
});

describe('removeRecipeFromMealPlan', () => {
  it('removes only the matching recipe from the matching day', () => {
    const existing: IMealPlan = [
      {
        date: 1000,
        plan: [
          { recipeId: 'recipe-1', components: [] },
          { recipeId: 'recipe-2', components: [] },
        ],
      },
      { date: 2000, plan: [{ recipeId: 'recipe-1', components: [] }] },
    ];

    const result = removeRecipeFromMealPlan(existing, 'recipe-1', 1000);

    expect(result).toEqual([
      { date: 1000, plan: [{ recipeId: 'recipe-2', components: [] }] },
      { date: 2000, plan: [{ recipeId: 'recipe-1', components: [] }] },
    ]);
  });

  it('is a no-op when the recipe is not planned for that day', () => {
    const existing: IMealPlan = [{ date: 1000, plan: [{ recipeId: 'recipe-2', components: [] }] }];

    const result = removeRecipeFromMealPlan(existing, 'recipe-1', 1000);

    expect(result).toEqual(existing);
  });
});
