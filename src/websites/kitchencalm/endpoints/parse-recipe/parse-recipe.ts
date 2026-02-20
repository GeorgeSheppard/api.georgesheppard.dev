import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getRecipeByUuid, updateRecipe as updateRecipeInDynamo } from '@core/dynamodb/utilities.js';
import { parseRecipeWithOpenAI } from '../../utils/openai-recipe-parser.js';
import { RecipeSchema } from '../../schemas.js';

export const ParseRecipeRequestSchema = z.object({
  recipeText: z.string().min(1).describe('Natural language recipe text to parse'),
  recipeId: z.string().uuid().optional().describe('Recipe UUID for editing existing recipes'),
  imageKey: z
    .string()
    .optional()
    .describe('S3 key of the image to associate with this recipe (from presigned upload endpoint)'),
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

  if (input.imageKey !== undefined) {
    recipe.image = { key: input.imageKey, timestamp: Date.now() };
  } else if (input.recipeId) {
    // Preserve existing image when editing without supplying a new one
    const existingRecipe = await getRecipeByUuid(dynamoClient.client, userId, input.recipeId);
    if (existingRecipe) {
      recipe.image = existingRecipe.image;
    }
  }

  await updateRecipeInDynamo(dynamoClient.client, userId, recipe);

  return recipe;
}
