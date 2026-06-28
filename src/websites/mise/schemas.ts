import { z } from '@hono/zod-openapi';
import { Unit } from '@core/types/recipes.js';

const QuantitySchema = z
  .object({
    unit: z.nativeEnum(Unit).describe('Unit of measurement'),
    value: z.number().optional().describe('Numeric value'),
  })
  .openapi('Quantity');

export const IngredientSchema = z
  .object({
    name: z.string().describe('Ingredient name'),
    quantity: QuantitySchema,
  })
  .openapi('Ingredient');

export const InstructionSchema = z
  .object({
    text: z.string().describe('Instruction text'),
    optional: z.boolean().optional().describe('Whether this step is optional'),
  })
  .openapi('Instruction');

export const ComponentSchema = z
  .object({
    name: z.string().describe('Component name'),
    uuid: z.string().uuid().describe('Component UUID'),
    ingredients: z.array(IngredientSchema).describe('List of ingredients'),
    instructions: z.array(InstructionSchema).describe('List of instructions'),
    storeable: z.boolean().optional().describe('Whether component can be made ahead'),
    servings: z.number().optional().describe('Number of servings'),
  })
  .openapi('Component');

export const ImageSchema = z
  .object({
    timestamp: z.number().describe('Image timestamp'),
    key: z.string().describe('S3 object key'),
    presignedUrl: z
      .string()
      .url()
      .optional()
      .describe('Presigned URL for downloading the image (undefined if generation failed)'),
  })
  .openapi('Image');

export const RecipeSchema = z
  .object({
    uuid: z.string().uuid().describe('Recipe UUID'),
    name: z.string().describe('Recipe name'),
    description: z.string().describe('Recipe description'),
    images: z.array(ImageSchema).describe('Recipe images'),
    components: z.array(ComponentSchema).describe('Recipe components'),
  })
  .openapi('Recipe');

// Schemas for OpenAI parsing (without UUID or images - we set those on the backend)
export const OpenAIComponentSchema = ComponentSchema.omit({ uuid: true });
export const OpenAIRecipeSchema = z
  .object({
    name: z.string().describe('Recipe name'),
    description: z.string().describe('Recipe description'),
    components: z.array(OpenAIComponentSchema).describe('Recipe components'),
  })
  .openapi('OpenAIRecipe');

export const MealPlanComponentSchema = z
  .object({
    componentId: z.string().uuid().describe('Recipe component UUID'),
    servings: z.number().describe('Number of servings'),
  })
  .openapi('MealPlanComponent');

export const MealPlanRecipeSchema = z
  .object({
    recipeId: z.string().uuid().describe('Recipe UUID'),
    components: z.array(MealPlanComponentSchema).describe('Recipe components'),
  })
  .openapi('MealPlanRecipe');

export const MealPlanDayEntrySchema = z
  .object({
    date: z.number().describe('Unix timestamp in milliseconds'),
    plan: z.array(MealPlanRecipeSchema).describe('Recipes for this day'),
  })
  .openapi('MealPlanDayEntry');

export const MealPlanSchema = z.array(MealPlanDayEntrySchema).openapi('MealPlan');

// Deprecated: kept for backwards compatibility
export const MealPlanEntrySchema = MealPlanComponentSchema;

// Deprecated: kept for backwards compatibility - this was the old nested structure
export const MealPlanDaySchema = z.record(
  z.string().uuid().describe('Recipe UUID'),
  z.array(MealPlanComponentSchema).describe('Array of component servings for this recipe')
);
