import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getAllRecipesForUser } from '@core/dynamodb/utilities.js';
import { RecipesMap, IRecipe } from '@core/types/recipes.js';
import { getSignedGetUrl } from '@core/s3/utilities.js';
import { RecipeSchema } from '../../schemas.js';

export const GetRecipesResponseSchema = z.record(z.string().uuid(), RecipeSchema);

export type GetRecipesResponse = z.infer<typeof GetRecipesResponseSchema>;

export async function getRecipes(c: ContextWithUserId): Promise<GetRecipesResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');
  const s3Client = c.get('s3Client');

  try {
    const recipes = await getAllRecipesForUser(dynamoClient.client, userId);

    const recipesWithPresignedUrls: IRecipe[] = await Promise.all(
      recipes.map(async (recipe) => ({
        ...recipe,
        images: await Promise.all(
          (recipe.images || []).map(async (image) => ({
            ...image,
            presignedUrl: await getSignedGetUrl(s3Client.client, image.key).catch((error) => {
              console.error(`Failed to generate presigned URL for image ${image.key}:`, error);
              return undefined;
            }),
          }))
        ),
      }))
    );

    const recipesMap: RecipesMap = recipesWithPresignedUrls.reduce((acc, recipe) => {
      acc[recipe.uuid] = recipe;
      return acc;
    }, {} as RecipesMap);

    return recipesMap;
  } catch (error) {
    console.error('Failed to fetch recipes for user', userId, error);
    throw error;
  }
}
