import { askJev, JevQuestion } from '@core/utils/jev-client.js';

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

  const criteria = Object.fromEntries([...CATEGORIES, 'Other'].map((category) => [category, null]));
  const questions: Record<string, JevQuestion> = Object.fromEntries(
    ingredients.map((ingredient, index) => [
      `q${index}`,
      {
        type: 'choice',
        instructions: `Which British supermarket section would you find the ingredient "${ingredient}" in? Use "Other" only if none fit.`,
        criteria,
      },
    ])
  );

  const answers = await askJev('Grocery shopping list', questions);

  const result: CategoryMap = {};
  ingredients.forEach((ingredient, index) => {
    const category = answers[`q${index}`]?.choice;
    result[ingredient] = category && isValidCategory(category) ? category : 'Other';
  });
  return result;
}

function isValidCategory(category: string): category is IngredientCategory {
  return category === 'Other' || (CATEGORIES as readonly string[]).includes(category);
}
