import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { IRecipe } from '@core/types/recipes.js';
import { logger } from '@core/telemetry/logger.js';
import { OpenAIRecipeSchema, RecipeSchema } from '../schemas.js';

const SYSTEM_PROMPT = `You are a recipe parsing assistant. Parse the provided natural language recipe text into a structured JSON format with the following fields:

1. "name": The name/title of the recipe (required, string)
2. "description": A brief description of the dish (required, string)
3. "components": An array of recipe components/sections. Each component has:
   - "name": Component name (e.g., "Main", "Sauce", "Topping") (required, string)
   - "ingredients": Array of ingredients with name and quantity. Each ingredient has:
     * "name": Ingredient name (string)
     * "quantity": Object with "unit" and optional "value":
       - "unit": The unit of measurement. MUST use only these units: "none" (for unmeasured), "mL", "L", "g", "kg", "cup", "tsp", "tbsp", "quantity" (for countable items)
       - "value": Only include this property if there is a numeric quantity. Never use 0 as a value.
       - CRITICAL: If an ingredient is specified as a "tin", "can", "jar", "bottle", or other container, convert it to the standard weight/volume equivalent:
         * 1 tin coconut milk → 400mL
         * 1 can tomatoes → 400g
         * 1 jar pesto → 190g
         * Always convert containers to one of the allowed units (g, mL, etc)
   - "instructions": Array of cooking steps with text and optional "optional" boolean
   - "storeable": Whether this component can be made ahead (optional, boolean)
   - "servings": Number of servings for this component (optional, number)

Do not include any image or images field in the response - images are managed separately by the backend.`;

// OpenAI strict mode schema - explicitly defined to ensure additionalProperties: false
// and all properties in required array for OpenAI's constrained sampling
const STRICT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: {
                  type: 'object',
                  properties: {
                    unit: {
                      enum: ['none', 'mL', 'L', 'g', 'kg', 'cup', 'tsp', 'tbsp', 'quantity'],
                    },
                    value: {
                      type: ['number', 'null'],
                    },
                  },
                  required: ['unit', 'value'],
                  additionalProperties: false,
                },
              },
              required: ['name', 'quantity'],
              additionalProperties: false,
            },
          },
          instructions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                optional: {
                  type: ['boolean', 'null'],
                },
              },
              required: ['text', 'optional'],
              additionalProperties: false,
            },
          },
          storeable: {
            type: ['boolean', 'null'],
          },
          servings: {
            type: ['number', 'null'],
          },
        },
        required: ['name', 'ingredients', 'instructions', 'storeable', 'servings'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'description', 'components'],
  additionalProperties: false,
};

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
        strict: true,
        schema: STRICT_SCHEMA,
      },
    },
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const rawParsed: unknown = JSON.parse(content);
  logger.info('OpenAI recipe response:', JSON.stringify(rawParsed, null, 2));

  const openAIResult = OpenAIRecipeSchema.safeParse(rawParsed);
  if (!openAIResult.success) {
    throw new Error(
      `OpenAI returned invalid recipe format: ${JSON.stringify(
        openAIResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
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
