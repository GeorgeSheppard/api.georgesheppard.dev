import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { z } from 'zod';
import { IRecipe } from '@core/types/recipes.js';
import { OpenAIRecipeSchema, RecipeSchema } from '../schemas.js';

// Recursively ensure schema meets strict mode requirements:
// - additionalProperties must be false on all objects
// - all properties must be in required array
function makeSchemaStrict(schema: Record<string, unknown>): Record<string, unknown> {
  const result = { ...schema };

  if (result.type === 'object' && typeof result.properties === 'object') {
    result.additionalProperties = false;
    const props = result.properties as Record<string, unknown>;
    result.required = Object.keys(props);
  }

  // Recursively process nested schemas
  if (typeof result.properties === 'object' && result.properties !== null) {
    const props = result.properties as Record<string, Record<string, unknown>>;
    result.properties = Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        typeof value === 'object' && value !== null ? makeSchemaStrict(value) : value,
      ])
    );
  }

  if (Array.isArray(result.items) && typeof result.items[0] === 'object') {
    result.items = result.items.map((item) =>
      typeof item === 'object' && item !== null ? makeSchemaStrict(item) : item
    );
  }

  if (typeof result.items === 'object' && result.items !== null) {
    result.items = makeSchemaStrict(result.items as Record<string, unknown>);
  }

  // Handle anyOf, oneOf, allOf
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    if (Array.isArray(result[key])) {
      result[key] = (result[key] as Record<string, unknown>[]).map((item) =>
        typeof item === 'object' && item !== null ? makeSchemaStrict(item) : item
      );
    }
  }

  return result;
}

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

const FIX_PROMPT = `You are a recipe JSON fixer. The following recipe JSON has validation errors. Fix only the invalid parts according to these rules:

Valid units are ONLY: "none", "mL", "L", "g", "kg", "cup", "tsp", "tbsp", "quantity"

If you see any other unit like "tin", "can", "oz", "lb", etc:
- Convert "tin" of liquid (coconut milk, etc) to "mL" with standard sizes (400mL for coconut milk)
- Convert "can" of solids (tomatoes, etc) to "g" with standard sizes (400g for tomatoes)
- Convert "oz" to "g" (1 oz ≈ 28g)
- Convert "lb" to "g" (1 lb ≈ 454g)
- Convert "fl oz" to "mL" (1 fl oz ≈ 30mL)
- For "pinch" or "dash", use "none" unit with no value
- Never invent units

Return ONLY the corrected JSON, no explanations.`;

export async function parseRecipeWithOpenAI(
  recipeText: string,
  openaiClient: OpenAI,
  recipeId?: string
): Promise<IRecipe> {
  const baseSchema = z.toJSONSchema(OpenAIRecipeSchema) as Record<string, unknown>;
  const strictSchema = makeSchemaStrict(baseSchema);

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
        schema: strictSchema,
      },
    },
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const rawParsed: unknown = JSON.parse(content);
  console.log('OpenAI recipe response:', JSON.stringify(rawParsed, null, 2));

  let openAIResult = OpenAIRecipeSchema.safeParse(rawParsed);

  // If validation fails, try to fix with a second LLM call
  if (!openAIResult.success) {
    console.log('Initial validation failed, attempting to fix with second LLM call...');
    const fixCompletion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: FIX_PROMPT },
        {
          role: 'user',
          content: `Fix this recipe JSON:\n\n${JSON.stringify(rawParsed, null, 2)}\n\nErrors: ${JSON.stringify(
            openAIResult.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            }))
          )}`,
        },
      ],
      temperature: 0.2,
    });

    const fixedContent = fixCompletion.choices[0]?.message?.content;
    if (!fixedContent) {
      throw new Error('No response from OpenAI fix attempt');
    }

    const fixedParsed: unknown = JSON.parse(fixedContent);
    console.log('Fixed recipe response:', JSON.stringify(fixedParsed, null, 2));

    openAIResult = OpenAIRecipeSchema.safeParse(fixedParsed);
    if (!openAIResult.success) {
      throw new Error(
        `OpenAI returned invalid recipe format after fix attempt: ${JSON.stringify(
          openAIResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
            received: (fixedParsed as Record<string, unknown>)[issue.path[0] as string],
          }))
        )}`
      );
    }
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
