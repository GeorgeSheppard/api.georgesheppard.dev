import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { z } from 'zod';
import { IRecipe } from '@core/types/recipes.js';
import { OpenAIRecipeSchema, RecipeSchema } from '../schemas.js';

const SYSTEM_PROMPT = `You are a recipe parsing assistant. Parse the provided natural language recipe text into a structured JSON format with the following fields:

1. "name": The name/title of the recipe (required, string)
2. "description": A brief description of the dish (required, string)
3. "components": An array of recipe components/sections. Each component has:
   - "name": Component name (e.g., "Main", "Sauce", "Topping") (required, string)
   - "ingredients": Array of ingredients with name and quantity (unit and optional value)
   - "instructions": Array of cooking steps with text and optional "optional" boolean
   - "storeable": Whether this component can be made ahead (optional, boolean)
   - "servings": Number of servings for this component (optional, number)

Do not include any image or images field in the response - images are managed separately by the backend.`;

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
    throw new Error(
      `OpenAI returned invalid recipe format: ${JSON.stringify(
        openAIResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          received: (rawParsed as Record<string, unknown>)[issue.path[0] as string],
        }))
      )}`
    );
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
