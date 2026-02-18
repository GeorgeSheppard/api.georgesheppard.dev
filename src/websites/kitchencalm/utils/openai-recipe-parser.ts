import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { IRecipe, Unit } from '@core/types/recipes.js';
import { RecipeSchema } from '../schemas.js';

const SYSTEM_PROMPT = `You are a recipe parsing assistant. Parse the provided natural language recipe text into a structured JSON format.

Return a JSON object matching this exact schema:
{
  "uuid": "<a new UUID v4>",
  "name": "<recipe name>",
  "description": "<brief description of the dish>",
  "images": [],
  "components": [
    {
      "name": "<component name, e.g. 'Main' or 'Sauce'>",
      "uuid": "<a new UUID v4>",
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
Group ingredients and instructions into logical components. Use a single "Main" component if the recipe has no distinct parts.
Always generate fresh UUID v4 values for uuid fields.`;

function sanitizeRecipe(parsed: unknown, validUnits: string[]): unknown {
  if (typeof parsed !== 'object' || parsed === null) return parsed;

  const obj = parsed as Record<string, unknown>;

  if (!obj.uuid || typeof obj.uuid !== 'string') {
    obj.uuid = uuidv4();
  }

  if (Array.isArray(obj.components)) {
    obj.components = obj.components.map((component: unknown) => {
      if (typeof component !== 'object' || component === null) return component;
      const comp = component as Record<string, unknown>;

      if (!comp.uuid || typeof comp.uuid !== 'string') {
        comp.uuid = uuidv4();
      }

      if (Array.isArray(comp.ingredients)) {
        comp.ingredients = comp.ingredients.map((ingredient: unknown) => {
          if (typeof ingredient !== 'object' || ingredient === null) return ingredient;
          const ing = ingredient as Record<string, unknown>;

          if (typeof ing.quantity === 'object' && ing.quantity !== null) {
            const qty = ing.quantity as Record<string, unknown>;
            if (!validUnits.includes(qty.unit as string)) {
              qty.unit = Unit.NO_UNIT;
            }
          }

          return ing;
        });
      }

      return comp;
    });
  }

  return obj;
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
  const validUnits = Object.values(Unit);
  const sanitized = sanitizeRecipe(parsed, validUnits);

  const result = RecipeSchema.safeParse(sanitized);
  if (!result.success) {
    throw new Error(`OpenAI returned invalid recipe format: ${result.error.message}`);
  }

  return result.data as IRecipe;
}
