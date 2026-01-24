import { z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cognitoAuthMiddleware } from '@core/middleware/cognito-auth.js';
import { getAllRecipesForUser } from '../../utils/dynamo.js';
import { recipeSchema } from '../../validators/index.js';
import { ROUTES } from '../paths.js';
import { CognitoUser } from '@core/middleware/cognito-auth.js';

export function registerGetRecipesRoute(app: OpenAPIHono) {
  app.get(ROUTES.GET_RECIPES, cognitoAuthMiddleware, async (c) => {
    const user = c.get('cognitoUser') as CognitoUser;
    const dynamoClient = c.get('dynamoDBClient');

    try {
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const recipes = await getAllRecipesForUser(dynamoClient, user.userId);

      // Convert array to Map-like object { [uuid]: recipe }
      const recipesMap = recipes.reduce(
        (acc, recipe) => {
          acc[recipe.uuid] = recipe;
          return acc;
        },
        {} as Record<string, typeof recipes[0]>
      );

      return c.json(recipesMap, 200);
    } catch (error) {
      console.error('Error getting recipes:', error);
      return c.json({ error: 'Failed to fetch recipes' }, 500);
    }
  });
}
