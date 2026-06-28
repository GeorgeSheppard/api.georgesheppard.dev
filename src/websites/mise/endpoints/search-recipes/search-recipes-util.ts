import Fuse, { IFuseOptions } from 'fuse.js';
import { IRecipe, RecipeUuid } from '@core/types/recipes.js';

/**
 * Flattened recipe structure for searching
 * Ingredients and instructions are flattened from nested components
 */
export interface SearchableRecipe {
  uuid: RecipeUuid;
  name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
}

/**
 * Transform a recipe into a searchable format
 * Flattens nested components structure for Fuse.js compatibility
 */
export function transformRecipeForSearch(recipe: IRecipe): SearchableRecipe {
  const ingredients = recipe.components.flatMap((component) =>
    component.ingredients.map((ingredient) => ingredient.name)
  );

  const instructions = recipe.components.flatMap((component) =>
    component.instructions.map((instruction) => instruction.text)
  );

  return {
    uuid: recipe.uuid,
    name: recipe.name,
    description: recipe.description,
    ingredients,
    instructions,
  };
}

/**
 * Search recipes using Fuse.js with fuzzy matching
 * @param recipes - Array of recipes to search
 * @param query - Search query string
 * @param fields - Optional array of fields to search (defaults to all)
 * @returns Array of matching recipe UUIDs
 */
export function searchRecipes(recipes: IRecipe[], query: string, fields?: string[]): RecipeUuid[] {
  if (!query.trim()) {
    return recipes.map((r) => r.uuid);
  }

  // Transform recipes to searchable format
  const searchableRecipes = recipes.map(transformRecipeForSearch);

  // Determine which fields to search
  const searchFields: (keyof SearchableRecipe)[] = fields
    ? (fields.filter((f) =>
        ['name', 'description', 'ingredients', 'instructions'].includes(f)
      ) as (keyof SearchableRecipe)[])
    : ['name', 'description', 'ingredients', 'instructions'];

  // Configure Fuse.js with options from the legacy recipe search implementation
  const fuseOptions: IFuseOptions<SearchableRecipe> = {
    threshold: 0.2,
    includeScore: true,
    findAllMatches: true,
    ignoreLocation: true,
    keys: searchFields,
  };

  const fuse = new Fuse(searchableRecipes, fuseOptions);

  // Execute search
  const results = fuse.search(query);

  // Extract UUIDs from results and remove duplicates
  const uuids = Array.from(new Set(results.map((result) => result.item.uuid)));

  return uuids;
}

/**
 * Parse comma-separated field string into array
 * @param fieldsString - Comma-separated fields like "name,ingredients"
 * @returns Array of valid field names
 */
export function parseSearchFields(fieldsString?: string): string[] | undefined {
  if (!fieldsString) {
    return undefined;
  }

  return fieldsString
    .split(',')
    .map((f) => f.trim())
    .filter((f) => ['name', 'description', 'ingredients', 'instructions'].includes(f));
}
