import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { z } from 'zod';
import { IRecipe } from '@core/types/recipes.js';
import { OpenAIRecipeSchema, RecipeSchema } from '../schemas.js';

const SYSTEM_PROMPT = `You are a recipe parsing assistant. Parse the provided natural language recipe text into a structured JSON format. Do not include any image or images field in the response - images are managed separately by the backend.`;

export async function parseRecipeWithOpenAI(
  recipeText: string,
  openaiClient: OpenAI,
  recipeId?: string
): Promise<IRecipe> {
  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: recipeText },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'recipe',
        strict: false,
        schema: z.toJSONSchema(OpenAIRecipeSchema),
      },
    },
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const rawParsed: unknown = JSON.parse(content);
  const openAIResult = OpenAIRecipeSchema.safeParse(rawParsed);
  if (!openAIResult.success) {
    throw new Error(`OpenAI returned invalid recipe format: ${openAIResult.error.message}`);
  }

  const parsed = openAIResult.data;

  // Add UUIDs and initialize empty images array (images are set separately via imageKey in the parse-recipe request)
  const recipe = {
    ...parsed,
    uuid: recipeId ?? uuidv4(),
    images: [],
    components: parsed.components.map((component) => ({
      ...component,
      uuid: uuidv4(),
    })),
  };

  const result = RecipeSchema.safeParse(recipe);
  if (!result.success) {
    throw new Error(`Recipe assembly failed: ${result.error.message}`);
  }

  return result.data as IRecipe;
}
