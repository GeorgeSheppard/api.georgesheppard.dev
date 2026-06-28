import OpenAI from 'openai';
import { config } from '@config/index.js';

const CATEGORIES = [
  'Fresh Fruit & Vegetables',
  'Fresh Meat & Poultry',
  'Fish & Seafood',
  'Dairy & Eggs',
  'Bakery',
  'Chilled & Deli',
  'Frozen',
  'Tins & Canned Goods',
  'Rice, Pasta & Grains',
  'Sauces & Condiments',
  'Herbs, Spices & Seasonings',
  'Baking',
  'Oils & Vinegars',
  'World Foods',
  'Drinks',
] as const;

export type IngredientCategory = (typeof CATEGORIES)[number] | 'Other';

export type CategoryMap = Record<string, IngredientCategory>;

export async function categoriseIngredients(ingredients: string[]): Promise<CategoryMap> {
  if (ingredients.length === 0) return {};

  const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `You categorise grocery ingredients into British supermarket sections. Return a JSON object mapping each ingredient to exactly one of these categories: ${CATEGORIES.join(', ')}, Other. Use "Other" only if none fit.`,
      },
      {
        role: 'user',
        content: JSON.stringify(ingredients),
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(content) as Record<string, string>;
  const result: CategoryMap = {};
  for (const ingredient of ingredients) {
    const category = parsed[ingredient];
    if (category && isValidCategory(category)) {
      result[ingredient] = category;
    } else {
      result[ingredient] = 'Other';
    }
  }
  return result;
}

function isValidCategory(category: string): category is IngredientCategory {
  return category === 'Other' || (CATEGORIES as readonly string[]).includes(category);
}
