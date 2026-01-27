import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { ROUTES } from '../paths.js';
import { getAllRecipesForAUser } from '@core/aws/dynamodb-utilities.js';

const UnitEnum = z.enum([
  'none',
  'mL',
  'L',
  'g',
  'kg',
  'cup',
  'tsp',
  'tbsp',
  'quantity',
]);

const InstructionSchema = z.object({
  text: z.string(),
  optional: z.boolean().optional(),
});

const QuantitySchema = z.object({
  unit: UnitEnum,
  value: z.number().optional(),
});

const IngredientSchema = z.object({
  name: z.string(),
  quantity: QuantitySchema,
});

const ComponentSchema = z.object({
  name: z.string(),
  uuid: z.string(),
  ingredients: z.array(IngredientSchema),
  instructions: z.array(InstructionSchema),
  storeable: z.boolean().optional(),
  servings: z.number().optional(),
});

const ImageSchema = z.object({
  url: z.string(),
  alt: z.string().optional(),
});

const RecipeSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  images: z.array(ImageSchema),
  components: z.array(ComponentSchema),
});

const SuccessSchema = z.object({
  recipes: z.array(RecipeSchema),
  success: z.literal(true),
});

const ErrorSchema = z.object({
  error: z.string(),
  success: z.literal(false),
});

const route = createRoute({
  method: 'get',
  path: ROUTES.GET_RECIPES,
  tags: ['kitchencalm-recipes'],
  request: {},
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessSchema } },
      description: 'Recipes retrieved successfully',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Internal server error',
    },
  },
});

export function registerGetRecipesRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    try {
      // TODO: Replace with authenticated user ID from middleware
      const userId = 'test-user-id';

      const recipes = await getAllRecipesForAUser(userId);

      return c.json(
        {
          recipes,
          success: true,
        },
        200
      );
    } catch (error) {
      console.error('Error fetching recipes:', error);
      return c.json(
        {
          error:
            error instanceof Error ? error.message : 'Failed to fetch recipes',
          success: false,
        },
        500
      );
    }
  });
}
