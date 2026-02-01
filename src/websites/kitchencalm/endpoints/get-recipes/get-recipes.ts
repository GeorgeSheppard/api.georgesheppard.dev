/**
 * Get Recipes handler for KitchenCalm endpoint
 *
 * This handler is reusable for both HTTP endpoints and MCP tools.
 * It queries DynamoDB for all recipes belonging to the authenticated user.
 */
import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getAllRecipesForUser } from '@core/dynamodb/utilities.js';
import { RecipesMap } from '@core/types/recipes.js';

/**
 * Zod schema for a recipe ingredient
 */
const IngredientSchema = z.object({
  name: z.string().describe('Ingredient name'),
  quantity: z.object({
    unit: z.enum(['none', 'mL', 'L', 'g', 'kg', 'cup', 'tsp', 'tbsp', 'quantity']),
    value: z.number().optional(),
  }),
});

/**
 * Zod schema for a recipe instruction
 */
const InstructionSchema = z.object({
  text: z.string().describe('Instruction text'),
  optional: z.boolean().optional().describe('Whether this step is optional'),
});

/**
 * Zod schema for a recipe component
 */
const ComponentSchema = z.object({
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
const ImageSchema = z.object({
  timestamp: z.number().describe('Image timestamp'),
  key: z.string().describe('S3 object key'),
});

/**
 * Zod schema for a single recipe
 */
const RecipeSchema = z.object({
  uuid: z.string().uuid().describe('Recipe UUID'),
  name: z.string().describe('Recipe name'),
  description: z.string().describe('Recipe description'),
  images: z.array(ImageSchema).describe('Recipe images'),
  components: z.array(ComponentSchema).describe('Recipe components'),
});

/**
 * Response schema: Map of recipe UUID to recipe object
 */
export const GetRecipesResponseSchema = z.record(z.string().uuid(), RecipeSchema);

export type GetRecipesResponse = z.infer<typeof GetRecipesResponseSchema>;

/**
 * Get all recipes for the authenticated user
 *
 * @param c - Hono context with userId from JWT and dynamoClient
 * @returns Map of recipe UUID to recipe object
 * @throws Error if DynamoDB query fails
 */
export async function getRecipes(c: ContextWithUserId): Promise<GetRecipesResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  try {
    // Query DynamoDB for all recipes for this user
    const recipes = await getAllRecipesForUser(dynamoClient.client, userId);

    // Convert array to Record<RecipeUuid, IRecipe> to match MyLife API response format
    const recipesMap: RecipesMap = recipes.reduce((acc, recipe) => {
      acc[recipe.uuid] = recipe;
      return acc;
    }, {} as RecipesMap);

    return recipesMap;
  } catch (error) {
    console.error('Failed to fetch recipes for user', userId, error);
    throw error;
  }
}
