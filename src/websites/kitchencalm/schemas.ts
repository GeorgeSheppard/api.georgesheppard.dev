import { z } from 'zod';
import { Unit } from '@core/types/recipes.js';

const QuantitySchema = z.object({
  unit: z.nativeEnum(Unit).describe('Unit of measurement'),
  value: z.number().optional().describe('Numeric value'),
});

export const IngredientSchema = z.object({
  name: z.string().describe('Ingredient name'),
  quantity: QuantitySchema,
});

export const InstructionSchema = z.object({
  text: z.string().describe('Instruction text'),
  optional: z.boolean().optional().describe('Whether this step is optional'),
});

export const ComponentSchema = z.object({
  name: z.string().describe('Component name'),
  uuid: z.string().uuid().describe('Component UUID'),
  ingredients: z.array(IngredientSchema).describe('List of ingredients'),
  instructions: z.array(InstructionSchema).describe('List of instructions'),
  storeable: z.boolean().optional().describe('Whether component can be made ahead'),
  servings: z.number().optional().describe('Number of servings'),
});

export const ImageSchema = z.object({
  timestamp: z.number().describe('Image timestamp'),
  key: z.string().describe('S3 object key'),
});

export const RecipeSchema = z.object({
  uuid: z.string().uuid().describe('Recipe UUID'),
  name: z.string().describe('Recipe name'),
  description: z.string().describe('Recipe description'),
  images: z.array(ImageSchema).describe('Recipe images'),
  components: z.array(ComponentSchema).describe('Recipe components'),
});

export const MealPlanEntrySchema = z.object({
  componentId: z.string().uuid().describe('Recipe component UUID'),
  servings: z.number().describe('Number of servings'),
});

export const MealPlanDaySchema = z.record(
  z.string().uuid().describe('Recipe UUID'),
  z.array(MealPlanEntrySchema).describe('Array of component servings for this recipe')
);
