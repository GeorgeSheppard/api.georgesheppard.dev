import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getRecipeByUuid, updateRecipe as updateRecipeInDynamo } from '@core/dynamodb/utilities.js';
import { parseRecipeWithOpenAI } from '../../utils/openai-recipe-parser.js';
import { RecipeSchema } from '../../schemas.js';

export const ParseRecipeRequestSchema = z.object({
  recipeText: z.string().min(1).describe('Natural language recipe text to parse'),
  recipeId: z.string().uuid().optional().describe('Recipe UUID for editing existing recipes'),
});

export type ParseRecipeRequest = z.infer<typeof ParseRecipeRequestSchema>;

export const ParseRecipeResponseSchema = RecipeSchema;

export type ParseRecipeResponse = z.infer<typeof ParseRecipeResponseSchema>;

export async function parseRecipe(
  c: ContextWithUserId,
  input: ParseRecipeRequest
): Promise<ParseRecipeResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');
  const openaiClient = c.get('openaiClient');

  const recipe = await parseRecipeWithOpenAI(
    input.recipeText,
    openaiClient.getClient(),
    input.recipeId
  );

  // Preserve existing images when editing a recipe
  if (input.recipeId) {
    const existingRecipe = await getRecipeByUuid(dynamoClient.client, userId, input.recipeId);
    if (existingRecipe) {
      recipe.images = existingRecipe.images;
    }
  }

  await updateRecipeInDynamo(dynamoClient.client, userId, recipe);

  return recipe;
}
