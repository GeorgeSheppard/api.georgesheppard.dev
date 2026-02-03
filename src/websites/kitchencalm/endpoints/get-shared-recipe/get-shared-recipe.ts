import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getSharedRecipe as getSharedRecipeFromDynamo } from '@core/dynamodb/shared-recipes.js';

export const GetSharedRecipeRequestSchema = z.object({
  shareId: z.string().uuid().describe('Share ID'),
});

export type GetSharedRecipeRequest = z.infer<typeof GetSharedRecipeRequestSchema>;

export const GetSharedRecipeResponseSchema = z.object({
  uuid: z.string().uuid().describe('Recipe UUID'),
  name: z.string().describe('Recipe name'),
  description: z.string().describe('Recipe description'),
  images: z.array(z.object({
    timestamp: z.number().describe('Image timestamp'),
    key: z.string().describe('S3 object key'),
  })),
  components: z.array(z.object({
    name: z.string().describe('Component name'),
    uuid: z.string().uuid().describe('Component UUID'),
    ingredients: z.array(z.object({
      name: z.string().describe('Ingredient name'),
      quantity: z.object({
        unit: z.enum(['none', 'mL', 'L', 'g', 'kg', 'cup', 'tsp', 'tbsp', 'quantity']),
        value: z.number().optional(),
      }),
    })),
    instructions: z.array(z.object({
      text: z.string().describe('Instruction text'),
      optional: z.boolean().optional(),
    })),
    storeable: z.boolean().optional(),
    servings: z.number().optional(),
  })).describe('Recipe components'),
}).nullable();

export type GetSharedRecipeResponse = z.infer<typeof GetSharedRecipeResponseSchema>;

export async function getSharedRecipe(
  c: ContextWithUserId,
  shareId: string
): Promise<GetSharedRecipeResponse> {
  const dynamoClient = c.get('dynamoClient');

  try {
    const recipe = await getSharedRecipeFromDynamo(dynamoClient.client, shareId);
    return recipe as any;
  } catch (error) {
    console.error('Failed to fetch shared recipe', shareId, error);
    throw error;
  }
}
