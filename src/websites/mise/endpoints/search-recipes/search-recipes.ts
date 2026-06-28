import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getAllRecipesForUser } from '@core/dynamodb/utilities.js';
import { searchRecipes, parseSearchFields } from './search-recipes-util.js';

/**
 * Request schema for search recipes endpoint
 */
export const SearchRecipesRequestSchema = z.object({
  q: z.string().min(1).describe('Search query string'),
  fields: z
    .string()
    .optional()
    .describe('Comma-separated fields to search: name,description,ingredients,instructions')
    .default('name,description,ingredients,instructions'),
});

export type SearchRecipesRequest = z.infer<typeof SearchRecipesRequestSchema>;

/**
 * Individual search result schema
 */
export const SearchRecipeResultSchema = z.object({
  uuid: z.string().uuid().describe('Recipe UUID'),
  name: z.string().describe('Recipe name'),
  description: z.string().describe('Recipe description'),
  ingredients: z.array(z.string()).describe('Flattened list of ingredient names'),
});

export type SearchRecipeResult = z.infer<typeof SearchRecipeResultSchema>;

/**
 * Response schema for search recipes endpoint
 */
export const SearchRecipesResponseSchema = z.object({
  results: z.array(SearchRecipeResultSchema).describe('Array of matching recipes'),
  count: z.number().int().nonnegative().describe('Number of results returned'),
});

export type SearchRecipesResponse = z.infer<typeof SearchRecipesResponseSchema>;

/**
 * Search recipes handler
 */
export async function searchRecipesHandler(
  c: ContextWithUserId,
  input: SearchRecipesRequest
): Promise<SearchRecipesResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    // Get all recipes for the user
    const recipes = await getAllRecipesForUser(dynamoClient.client, userId);

    // Parse and validate search fields
    const fieldsArray = parseSearchFields(input.fields);

    // Perform search
    const matchingUuids = searchRecipes(recipes, input.q, fieldsArray);

    // Build results by finding the matching recipes and extracting minimal data
    const results: SearchRecipeResult[] = matchingUuids
      .map((uuid) => recipes.find((r) => r.uuid === uuid))
      .filter((recipe) => recipe !== undefined)
      .map((recipe) => ({
        uuid: recipe!.uuid,
        name: recipe!.name,
        description: recipe!.description,
        ingredients: recipe!.components.flatMap((component) =>
          component.ingredients.map((ingredient) => ingredient.name)
        ),
      }));

    return {
      results,
      count: results.length,
    };
  } catch (error) {
    console.error('Failed to search recipes for user', userId, error);
    throw error;
  }
}
