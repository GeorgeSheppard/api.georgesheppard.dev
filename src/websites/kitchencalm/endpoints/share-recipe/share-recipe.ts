import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { createSharedRecipe } from '@core/dynamodb/shared-recipes.js';
import { IRecipe } from '@core/types/recipes.js';
import { RecipeSchema } from '../../schemas.js';

export const ShareRecipeRequestSchema = z.object({
  recipe: RecipeSchema,
});

export type ShareRecipeRequest = z.infer<typeof ShareRecipeRequestSchema>;

export const ShareRecipeResponseSchema = z.object({
  shareId: z.string().uuid().describe('Unique share ID for public access'),
});

export type ShareRecipeResponse = z.infer<typeof ShareRecipeResponseSchema>;

export async function shareRecipe(
  c: ContextWithUserId,
  recipe: IRecipe
): Promise<ShareRecipeResponse> {
  const dynamoClient = c.get('dynamoClient');

  try {
    const { shareId } = await createSharedRecipe(dynamoClient.client, recipe as any);

    return {
      shareId,
    };
  } catch (error) {
    console.error('Failed to share recipe', error);
    throw error;
  }
}
