import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ContextWithUserId } from '@core/types/context.js';
import { updateRecipe as updateRecipeInDynamo } from '@core/dynamodb/utilities.js';
import { IRecipe } from '@core/types/recipes.js';
import { ComponentSchema, ImageSchema } from '../../schemas.js';

export const UpdateRecipeRequestSchema = z.object({
  uuid: z.string().uuid().optional().describe('Recipe UUID (omit to generate new)'),
  name: z.string().describe('Recipe name'),
  description: z.string().describe('Recipe description'),
  images: z.array(ImageSchema).describe('Recipe images'),
  components: z.array(ComponentSchema).describe('Recipe components'),
});

export type UpdateRecipeRequest = z.infer<typeof UpdateRecipeRequestSchema>;

export const UpdateRecipeResponseSchema = z.object({
  uuid: z.string().uuid().describe('Recipe UUID (new or provided)'),
  success: z.boolean().describe('Whether update was successful'),
});

export type UpdateRecipeResponse = z.infer<typeof UpdateRecipeResponseSchema>;

export async function updateRecipe(
  c: ContextWithUserId,
  recipe: UpdateRecipeRequest
): Promise<UpdateRecipeResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    const recipeUuid = recipe.uuid || uuidv4();

    const recipeToStore: IRecipe = {
      uuid: recipeUuid,
      name: recipe.name,
      description: recipe.description,
      images: recipe.images,
      components: recipe.components,
    };

    await updateRecipeInDynamo(dynamoClient.client, userId, recipeToStore);

    return {
      uuid: recipeUuid,
      success: true,
    };
  } catch (error) {
    console.error('Failed to update recipe for user', userId, error);
    throw error;
  }
}
