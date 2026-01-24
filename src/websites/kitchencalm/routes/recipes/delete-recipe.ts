import { z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cognitoAuthMiddleware } from '@core/middleware/cognito-auth.js';
import { deleteRecipe } from '../../utils/dynamo.js';
import { ROUTES } from '../paths.js';
import { CognitoUser } from '@core/middleware/cognito-auth.js';

export function registerDeleteRecipeRoute(app: OpenAPIHono) {
  app.delete(ROUTES.DELETE_RECIPE, cognitoAuthMiddleware, async (c) => {
    const id = c.req.param('id') as string;
    const user = c.get('cognitoUser') as CognitoUser;
    const dynamoClient = c.get('dynamoDBClient');

    try {
      await deleteRecipe(dynamoClient, user.userId, id);
      return c.json({ success: true }, 200);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return c.json({ error: 'Recipe not found' }, 404);
      }
      console.error('Error deleting recipe:', error);
      return c.json({ error: 'Failed to delete recipe' }, 500);
    }
  });
}
