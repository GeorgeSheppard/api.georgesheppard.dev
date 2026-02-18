import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { IRecipe, Unit } from '@core/types/recipes.js';
import { RecipeSchema } from '../schemas.js';

const SYSTEM_PROMPT = `You are a recipe parsing assistant. Parse the provided natural language recipe text into a structured JSON format.

Return a JSON object matching this exact schema (do NOT include uuid fields):
{
  "name": "<recipe name>",
  "description": "<brief description of the dish>",
  "images": [],
  "components": [
    {
      "name": "<component name, e.g. 'Main' or 'Sauce'>",
      "ingredients": [
        {
          "name": "<ingredient name>",
          "quantity": {
            "unit": "<one of: none, mL, L, g, kg, cup, tsp, tbsp, quantity>",
            "value": <numeric value or omit if not specified>
          }
        }
      ],
      "instructions": [
        {
          "text": "<instruction step>",
          "optional": <true or false, omit if not optional>
        }
      ],
      "storeable": <true if this component can be made ahead, omit otherwise>,
      "servings": <number of servings, omit if not specified>
    }
  ]
}

Unit values must be one of: "none", "mL", "L", "g", "kg", "cup", "tsp", "tbsp", "quantity".
Group ingredients and instructions into logical components. Use a single "Main" component if the recipe has no distinct parts.`;

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

function validateAndFixUnits(recipe: Record<string, unknown>, validUnits: string[]): void {
  if (Array.isArray(recipe.components)) {
    recipe.components.forEach((component: unknown) => {
      if (typeof component === 'object' && component !== null) {
        const comp = component as Record<string, unknown>;

        if (Array.isArray(comp.ingredients)) {
          comp.ingredients.forEach((ingredient: unknown) => {
            if (typeof ingredient === 'object' && ingredient !== null) {
              const ing = ingredient as Record<string, unknown>;

              if (typeof ing.quantity === 'object' && ing.quantity !== null) {
                const qty = ing.quantity as Record<string, unknown>;
                if (!validUnits.includes(qty.unit as string)) {
                  qty.unit = Unit.NO_UNIT;
                }
              }
            }
          });
        }
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
    response_format: { type: 'json_object' },
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
  const validUnits = Object.values(Unit);

  // Inject UUIDs and validate units
  injectUUIDs(recipe);
  validateAndFixUnits(recipe, validUnits);

  const result = RecipeSchema.safeParse(recipe);
  if (!result.success) {
    throw new Error(`OpenAI returned invalid recipe format: ${result.error.message}`);
  }

  return result.data as IRecipe;
}
