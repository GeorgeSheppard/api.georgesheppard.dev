import { IMealPlan, IMealPlanRecipe } from '@core/types/meal-plan.js';
import { IRecipe } from '@core/types/recipes.js';

/**
 * Parses a 'YYYY-MM-DD' date string into the UTC-midnight timestamp used as the
 * meal plan's date key, independent of the server's local timezone.
 */
export function parseMealPlanDate(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error(`Invalid date "${isoDate}", expected format YYYY-MM-DD`);
  }
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

export function addRecipeToMealPlan(
  mealPlan: IMealPlan,
  recipe: IRecipe,
  date: number,
  servingsOverride?: number
): IMealPlan {
  const components = recipe.components.map((component) => ({
    componentId: component.uuid,
    servings: servingsOverride ?? component.servings ?? 1,
  }));

  const dayEntry = mealPlan.find((entry) => entry.date === date);
  if (!dayEntry) {
    return [...mealPlan, { date, plan: [{ recipeId: recipe.uuid, components }] }].sort(
      (a, b) => a.date - b.date
    );
  }

  const existingRecipeEntry = dayEntry.plan.find((entry) => entry.recipeId === recipe.uuid);
  const updatedDayPlan: IMealPlanRecipe[] = existingRecipeEntry
    ? dayEntry.plan.map((entry) =>
        entry.recipeId === recipe.uuid ? { ...entry, components } : entry
      )
    : [...dayEntry.plan, { recipeId: recipe.uuid, components }];

  return mealPlan.map((entry) =>
    entry.date === date ? { ...entry, plan: updatedDayPlan } : entry
  );
}

export function removeRecipeFromMealPlan(
  mealPlan: IMealPlan,
  recipeUuid: string,
  date: number
): IMealPlan {
  return mealPlan.map((entry) =>
    entry.date === date
      ? { ...entry, plan: entry.plan.filter((recipeEntry) => recipeEntry.recipeId !== recipeUuid) }
      : entry
  );
}
