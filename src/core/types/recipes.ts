/**
 * Recipe type definitions for KitchenCalm/MyLife backend
 */

/**
 * Supported ingredient units for recipes
 */
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

/**
 * UUID types for type safety
 */
export type RecipeUuid = string;
export type ComponentUuid = string;

/**
 * Recipe image stored in S3
 */
export interface Image {
  timestamp: number;
  key: string;
}

/**
 * Ingredient quantity with unit and optional value
 */
export interface IQuantity {
  unit: Unit;
  value?: number;
}

/**
 * Single ingredient in a recipe component
 */
export interface IRecipeIngredient {
  name: string;
  quantity: IQuantity;
}

/**
 * Cooking instruction for a recipe component
 */
export interface IInstruction {
  text: string;
  optional?: boolean;
}

/**
 * A component of a recipe (e.g., "Main dish", "Sauce")
 * Components allow recipes to have multiple parts
 */
export interface IRecipeComponent {
  name: string;
  uuid: ComponentUuid;
  ingredients: IRecipeIngredient[];
  instructions: IInstruction[];
  storeable?: boolean;
  servings?: number;
}

/**
 * Complete recipe with ingredients and instructions
 */
export interface IRecipe {
  uuid: RecipeUuid;
  name: string;
  description: string;
  images: Image[];
  components: IRecipeComponent[];
}

/**
 * API response format: Map of recipe UUID to recipe object
 */
export type RecipesMap = Record<RecipeUuid, IRecipe>;
