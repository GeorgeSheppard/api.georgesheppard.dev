import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { updateRecipe as updateRecipeInDynamo } from '@core/dynamodb/utilities.js';
import { parseRecipeWithOpenAI } from '../../utils/openai-recipe-parser.js';
import { RecipeSchema } from '../../schemas.js';

export const ParseRecipeRequestSchema = z.object({
  recipeText: z.string().min(1).describe('Natural language recipe text to parse'),
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

  const recipe = await parseRecipeWithOpenAI(input.recipeText, openaiClient.getClient());

  await updateRecipeInDynamo(dynamoClient.client, userId, recipe);

  return recipe;
}
