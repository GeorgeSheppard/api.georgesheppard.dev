import { ComponentUuid, RecipeUuid } from './recipes.js';

export type DateString = string;

export type IMealPlan = { [index: DateString]: IDailyMealPlan };

export interface IDailyMealPlan {
  [index: RecipeUuid]: IComponentItem[];
}

export interface IComponentItem {
  componentId: ComponentUuid;
  servings: number;
}
