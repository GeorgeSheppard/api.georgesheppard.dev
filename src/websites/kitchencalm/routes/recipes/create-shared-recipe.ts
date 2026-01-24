import { z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { putSharedRecipe } from '../../utils/dynamo.js';
import { recipeSchema } from '../../validators/index.js';
import { ROUTES } from '../paths.js';
import { randomUUID } from 'crypto';

export function registerCreateSharedRecipeRoute(app: OpenAPIHono) {
  app.post(ROUTES.CREATE_SHARED_RECIPE, async (c) => {
    const dynamoClient = c.get('dynamoDBClient');

    try {
      const body = await c.req.json();
      const { recipe } = body;

      // Validate recipe data
      const validatedRecipe = recipeSchema.parse(recipe);

      // Generate share ID
      const shareId = randomUUID();

      await putSharedRecipe(dynamoClient, shareId, validatedRecipe);

      return c.json({ shareId }, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid recipe data' }, 400);
      }
      console.error('Error creating shared recipe:', error);
      return c.json({ error: 'Failed to create shared recipe' }, 500);
    }
  });
}
