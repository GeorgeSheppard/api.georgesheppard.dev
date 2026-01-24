import { z } from '@hono/zod-openapi';
import {
  IInstruction,
  IQuantity,
  IRecipe,
  IRecipeComponent,
  IRecipeIngredient,
  Image,
  Unit,
} from '../types/index.js';

export const imageSchema: z.ZodType<Image> = z
  .object({
    timestamp: z.number().openapi({
      example: 1704067200000,
      description: 'Image timestamp in milliseconds',
    }),
    key: z.string().openapi({
      example: 'user-123/recipe-image-1.jpg',
      description: 'S3 object key for the image',
    }),
  })
  .openapi('Image');

export const quantitySchema: z.ZodType<IQuantity> = z
  .object({
    unit: z.nativeEnum(Unit).openapi({
      example: Unit.GRAM,
      description: 'Unit of measurement',
    }),
    value: z.number().optional().openapi({
      example: 100,
      description: 'Numeric value of the quantity',
    }),
  })
  .openapi('Quantity');

export const ingredientSchema: z.ZodType<IRecipeIngredient> = z
  .object({
    name: z.string().openapi({
      example: 'Flour',
      description: 'Ingredient name',
    }),
    quantity: quantitySchema.openapi({
      description: 'Quantity of the ingredient',
    }),
  })
  .openapi('RecipeIngredient');

export const instructionSchema: z.ZodType<IInstruction> = z
  .object({
    text: z.string().openapi({
      example: 'Mix ingredients together',
      description: 'Instruction text',
    }),
    optional: z.boolean().optional().openapi({
      example: false,
      description: 'Whether this step is optional',
    }),
  })
  .openapi('Instruction');

export const componentSchema: z.ZodType<IRecipeComponent> = z
  .object({
    name: z.string().openapi({
      example: 'Dough',
      description: 'Component name',
    }),
    uuid: z.string().uuid().openapi({
      description: 'Unique component ID',
    }),
    ingredients: z.array(ingredientSchema).openapi({
      description: 'List of ingredients for this component',
    }),
    instructions: z.array(instructionSchema).openapi({
      description: 'List of instructions for this component',
    }),
    storeable: z.boolean().optional().openapi({
      example: true,
      description: 'Whether this component can be stored',
    }),
    servings: z.number().optional().openapi({
      example: 4,
      description: 'Number of servings',
    }),
  })
  .openapi('RecipeComponent');

export const recipeSchema: z.ZodType<IRecipe> = z
  .object({
    uuid: z.string().uuid().openapi({
      description: 'Unique recipe ID',
    }),
    name: z.string().openapi({
      example: 'Chocolate Chip Cookies',
      description: 'Recipe name',
    }),
    description: z.string().openapi({
      example: 'Classic chocolate chip cookies',
      description: 'Recipe description',
    }),
    images: z.array(imageSchema).openapi({
      description: 'Recipe images',
    }),
    components: z.array(componentSchema).openapi({
      description: 'Recipe components and instructions',
    }),
  })
  .openapi('Recipe');
