import { IRecipe, Unit } from '@core/types/recipes.js';
import { IMealPlan } from '@core/types/meal-plan.js';
import { Quantities } from './quantities.js';

export interface IQuantitiesAndMeals {
  [index: string]: {
    meals: Set<string>;
    quantities: Array<{
      unit: Unit;
      value?: number;
    }>;
  };
}

export function createShoppingListData(
  recipes: IRecipe[],
  mealPlan: IMealPlan,
  selectedDates?: Set<string>
): IQuantitiesAndMeals {
  const quantityAndMeals: IQuantitiesAndMeals = {};

  // If no dates selected, use all dates from meal plan
  const datesToProcess = selectedDates || new Set(Object.keys(mealPlan));

  for (const date of Object.keys(mealPlan)) {
    if (!datesToProcess.has(date)) {
      continue;
    }

    const dayMealPlan = mealPlan[date];
    for (const [recipeId, components] of Object.entries(dayMealPlan)) {
      const recipe = recipes.find((rec) => rec.uuid === recipeId);
      if (!recipe) {
        continue;
      }

      for (const component of components) {
        if (component.servings === 0) {
          continue;
        }

        const recipeComponent = recipe.components.find(
          (comp) => comp.uuid === component.componentId
        );
        if (!recipeComponent) {
          continue;
        }

        const { servings = 1 } = recipeComponent;
        recipeComponent.ingredients.forEach((recipeIngredient) => {
          const { name, quantity } = recipeIngredient;

          if (!(name in quantityAndMeals)) {
            quantityAndMeals[name] = {
              meals: new Set<string>(),
              quantities: [],
            };
          }

          const ratio = component.servings / servings;

          quantityAndMeals[name].meals.add(recipe.name);
          const currentQuantities = quantityAndMeals[name].quantities;

          const quantityIndex = currentQuantities.findIndex(
            (quant) => quant.unit === quantity.unit
          );
          const value = (quantity.value ?? 0) * ratio;
          if (quantityIndex > -1) {
            if (quantity.unit !== Unit.NO_UNIT) {
              currentQuantities[quantityIndex] = {
                unit: quantity.unit,
                value: (currentQuantities[quantityIndex].value ?? 0) + value,
              };
            }
          } else {
            currentQuantities.push({
              unit: quantity.unit,
              value,
            });
          }
        });
      }
    }
  }
  return quantityAndMeals;
}

export function createShoppingList(
  quantityAndMeals: IQuantitiesAndMeals,
  options: {
    includeMeals: boolean;
    categories?: Record<string, string>;
  }
): string {
  const ingredientsWithQuantities = Object.entries(quantityAndMeals).map(
    ([ingredient, { meals, quantities }]) => {
      const quantityString = quantities.map((quantity) => {
        return Quantities.toString(quantity) ?? 'extra';
      });

      const category = options.categories?.[ingredient] ?? 'Other';

      let text = `${ingredient} (${quantityString.join(' + ')})`;
      if (options.includeMeals) {
        text += ` [${Array.from(meals).join(', ')}]`;
      }
      return [text, category] as const;
    }
  );

  if (!options.categories) {
    return ingredientsWithQuantities
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([text]) => text)
      .join('\n');
  }

  const categoriesWithIngredients = ingredientsWithQuantities.reduce(
    (cats, [text, category]) => {
      if (category in cats) {
        cats[category].push(text);
      } else {
        cats[category] = [text];
      }
      return cats;
    },
    {} as { [index: string]: string[] }
  );

  const { Other, ...rest } = categoriesWithIngredients;

  const list = [
    ...Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)),
    ['Other', Other ?? []] as const,
  ]
    .filter(([_, ingredients]) => ingredients.length > 0)
    .map(([category, ingredients]) => {
      const sortedIngredients = (ingredients as string[]).sort((a, b) => a.localeCompare(b));
      return `${category}\n${sortedIngredients.join('\n')}`;
    });

  return list.join('\n\n');
}
