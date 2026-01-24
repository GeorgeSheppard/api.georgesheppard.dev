import { z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cognitoAuthMiddleware } from '@core/middleware/cognito-auth.js';
import { putRecipe } from '../../utils/dynamo.js';
import { recipeSchema } from '../../validators/index.js';
import { ROUTES } from '../paths.js';
import { CognitoUser } from '@core/middleware/cognito-auth.js';

const BodySchema = z.object({
  recipe: recipeSchema,
});

export function registerUpdateRecipeRoute(app: OpenAPIHono) {
  app.put(ROUTES.UPDATE_RECIPE, cognitoAuthMiddleware, async (c) => {
    const user = c.get('cognitoUser') as CognitoUser;
    const dynamoClient = c.get('dynamoDBClient');

    try {
      const body = await c.req.json();
      const { recipe } = body;

      // Validate recipe data
      const validatedRecipe = recipeSchema.parse(recipe);

      await putRecipe(dynamoClient, user.userId, validatedRecipe);

      return c.json({ success: true }, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid recipe data' }, 400);
      }
      console.error('Error updating recipe:', error);
      return c.json({ error: 'Failed to update recipe' }, 500);
    }
  });
}
