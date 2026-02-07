import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getAllRecipesForUser } from '@core/dynamodb/utilities.js';
import { RecipesMap } from '@core/types/recipes.js';
import { RecipeSchema } from '../../schemas.js';

export const GetRecipesResponseSchema = z.record(z.string().uuid(), RecipeSchema);

export type GetRecipesResponse = z.infer<typeof GetRecipesResponseSchema>;

export async function getRecipes(c: ContextWithUserId): Promise<GetRecipesResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    const recipes = await getAllRecipesForUser(dynamoClient.client, userId);

    const recipesMap: RecipesMap = recipes.reduce((acc, recipe) => {
      acc[recipe.uuid] = recipe;
      return acc;
    }, {} as RecipesMap);

    return recipesMap;
  } catch (error) {
    console.error('Failed to fetch recipes for user', userId, error);
    throw error;
  }
}
