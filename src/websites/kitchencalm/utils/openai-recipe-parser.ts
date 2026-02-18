import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { IRecipe } from '@core/types/recipes.js';
import { RecipeSchema } from '../schemas.js';

const SYSTEM_PROMPT = `You are a recipe parsing assistant. Parse the provided natural language recipe text into a structured JSON format.`;

// JSON Schema for structured outputs (without uuid fields)
const RECIPE_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', description: 'Recipe name' },
    description: { type: 'string', description: 'Brief description of the dish' },
    images: { type: 'array', items: { type: 'object' }, description: 'Images array' },
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Component name (e.g., "Main" or "Sauce")',
          },
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
                      type: 'string',
                      enum: ['none', 'mL', 'L', 'g', 'kg', 'cup', 'tsp', 'tbsp', 'quantity'],
                      description: 'Unit of measurement',
                    },
                    value: {
                      type: 'number',
                      description: 'Numeric quantity value (optional)',
                    },
                  },
                  required: ['unit'],
                },
              },
              required: ['name', 'quantity'],
            },
          },
          instructions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                optional: { type: 'boolean' },
              },
              required: ['text'],
            },
          },
          storeable: { type: 'boolean', description: 'Can be made ahead and stored' },
          servings: { type: 'number', description: 'Number of servings' },
        },
        required: ['name', 'ingredients', 'instructions'],
      },
    },
  },
  required: ['name', 'description', 'images', 'components'],
};

function injectUUIDs(recipe: Record<string, unknown>): void {
  recipe.uuid = uuidv4();

  if (Array.isArray(recipe.components)) {
    recipe.components.forEach((component: unknown) => {
      if (typeof component === 'object' && component !== null) {
        const comp = component as Record<string, unknown>;
        comp.uuid = uuidv4();
      }
    });
  }
}

export async function parseRecipeWithOpenAI(
  recipeText: string,
  openaiClient: OpenAI
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
        schema: RECIPE_SCHEMA,
        strict: true,
      },
    } as Parameters<typeof openaiClient.chat.completions.create>[0]['response_format'],
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid recipe format from OpenAI');
  }

  const recipe = parsed as Record<string, unknown>;

  // Inject UUIDs
  injectUUIDs(recipe);

  const result = RecipeSchema.safeParse(recipe);
  if (!result.success) {
    throw new Error(`OpenAI returned invalid recipe format: ${result.error.message}`);
  }

  return result.data as IRecipe;
}
