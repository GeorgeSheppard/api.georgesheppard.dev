import { Image } from './general.js';

export enum Unit {
  NO_UNIT = 'none',
  MILLILITER = 'mL',
  LITER = 'L',
  GRAM = 'g',
  KILOGRAM = 'kg',
  CUP = 'cup',
  TEASPOON = 'tsp',
  TABLESPOON = 'tbsp',
  NUMBER = 'quantity',
}

export type RecipeUuid = string;
export type ComponentUuid = string;
export type IngredientUuid = string;
export type IIngredientName = string;

export interface IInstruction {
  text: string;
  /**
   * Assumed false
   */
  optional?: boolean;
}

export interface IQuantity {
  unit: Unit;
  value?: number;
}

export interface IRecipeIngredient {
  name: IIngredientName;
  quantity: IQuantity;
}

export interface IRecipeComponent {
  name: string;
  uuid: ComponentUuid;
  ingredients: IRecipeIngredient[];
  instructions: IInstruction[];
  storeable?: boolean;
  servings?: number;
}

export interface IRecipe {
  uuid: RecipeUuid;
  name: string;
  description: string;
  images: Image[];
  components: IRecipeComponent[];
}

export type IRecipes = Map<RecipeUuid, IRecipe>;
