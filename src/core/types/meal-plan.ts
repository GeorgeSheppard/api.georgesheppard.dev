/**
 * Meal plan type definitions for Mise backend
 */

import { RecipeUuid } from './recipes.js';

/**
 * Single component serving entry in a recipe meal plan
 */
export interface IMealPlanComponent {
  componentId: string;
  servings: number;
}

/**
 * Recipe entry with its components in a meal plan
 */
export interface IMealPlanRecipe {
  recipeId: RecipeUuid;
  components: IMealPlanComponent[];
}

/**
 * Single day entry in the meal plan array
 */
export interface IMealPlanDayEntry {
  date: number; // Unix timestamp in milliseconds
  plan: IMealPlanRecipe[];
}

/**
 * Complete meal plan: array of day entries sorted by date
 */
export type IMealPlan = IMealPlanDayEntry[];

/**
 * @deprecated Use IMealPlanComponent instead
 */
export type IMealPlanEntry = IMealPlanComponent;

/**
 * @deprecated No longer used with new array-based structure
 */
export type RecipeMealEntries = IMealPlanComponent[];

/**
 * @deprecated No longer used with new array-based structure
 */
export interface IMealPlanDay {
  [recipeUuid: RecipeUuid]: RecipeMealEntries;
}
