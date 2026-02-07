/**
 * Shared Zod schemas for KitchenCalm endpoints
 *
 * This file centralizes all reusable schema definitions to avoid duplication
 * across multiple endpoint handlers.
 */

import { z } from 'zod';
import { Unit } from '@core/types/recipes.js';

/**
 * Zod schema for a recipe ingredient
 */
export const IngredientSchema = z.object({
  name: z.string().describe('Ingredient name'),
  quantity: z.object({
    unit: z.nativeEnum(Unit),
    value: z.number().optional(),
  }),
});

/**
 * Zod schema for a recipe instruction
 */
export const InstructionSchema = z.object({
  text: z.string().describe('Instruction text'),
  optional: z.boolean().optional().describe('Whether this step is optional'),
});

/**
 * Zod schema for a recipe component
 */
export const ComponentSchema = z.object({
  name: z.string().describe('Component name (e.g., "Main dish", "Sauce")'),
  uuid: z.string().uuid().describe('Component UUID'),
  ingredients: z.array(IngredientSchema),
  instructions: z.array(InstructionSchema),
  storeable: z.boolean().optional().describe('Whether component can be made ahead'),
  servings: z.number().optional().describe('Number of servings'),
});

/**
 * Zod schema for a recipe image
 */
export const ImageSchema = z.object({
  timestamp: z.number().describe('Image timestamp'),
  key: z.string().describe('S3 object key'),
});

/**
 * Zod schema for a single recipe
 */
export const RecipeSchema = z.object({
  uuid: z.string().uuid().describe('Recipe UUID'),
  name: z.string().describe('Recipe name'),
  description: z.string().describe('Recipe description'),
  images: z.array(ImageSchema).describe('Recipe images'),
  components: z.array(ComponentSchema).describe('Recipe components'),
});

/**
 * Zod schema for meal plan entry
 */
export const MealPlanEntrySchema = z.object({
  componentId: z.string().describe('Recipe component UUID'),
  servings: z.number().describe('Number of servings'),
});

/**
 * Zod schema for a single day's recipes
 */
export const MealPlanDaySchema = z.record(z.string().uuid(), z.array(MealPlanEntrySchema));
