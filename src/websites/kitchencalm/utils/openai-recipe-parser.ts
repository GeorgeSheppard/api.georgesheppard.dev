import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { IRecipe } from '@core/types/recipes.js';
import { OpenAIRecipeSchema, RecipeSchema } from '../schemas.js';

const SYSTEM_PROMPT = `You are a recipe parsing assistant. Parse the provided natural language recipe text into a structured JSON format.`;

export async function parseRecipeWithOpenAI(
  recipeText: string,
  openaiClient: OpenAI
): Promise<IRecipe> {
  const completion = await openaiClient.beta.chat.completions.parse({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: recipeText },
    ],
    response_format: zodResponseFormat(OpenAIRecipeSchema, 'recipe'),
    temperature: 0.2,
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error('No response from OpenAI');
  }

  // Add UUIDs to the parsed recipe
  const recipe = {
    ...parsed,
    uuid: uuidv4(),
    components: parsed.components.map((component) => ({
      ...component,
      uuid: uuidv4(),
    })),
  };

  const result = RecipeSchema.safeParse(recipe);
  if (!result.success) {
    throw new Error(`OpenAI returned invalid recipe format: ${result.error.message}`);
  }

  return result.data as IRecipe;
}
