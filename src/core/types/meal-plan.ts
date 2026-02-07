/**
 * Meal plan type definitions for KitchenCalm/MyLife backend
 */

import { RecipeUuid } from './recipes.js';

/**
 * Single serving entry for a recipe component in meal plan
 */
export interface IMealPlanEntry {
  componentId: string;
  servings: number;
}

/**
 * All entries for a single recipe on a single date
 */
export type RecipeMealEntries = IMealPlanEntry[];

/**
 * All recipes on a single date
 */
export interface IMealPlanDay {
  [recipeUuid: RecipeUuid]: RecipeMealEntries;
}

/**
 * Complete meal plan: date string -> recipes on that date
 * Date format: "DayName - MM/DD/YYYY" (e.g., "Monday - 01/08/2024")
 */
export interface IMealPlan {
  [dateString: string]: IMealPlanDay;
}
