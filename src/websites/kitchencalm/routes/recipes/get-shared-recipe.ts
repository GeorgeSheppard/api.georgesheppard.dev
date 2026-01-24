import { OpenAPIHono } from '@hono/zod-openapi';
import { getSharedRecipe } from '../../utils/dynamo.js';
import { ROUTES } from '../paths.js';

export function registerGetSharedRecipeRoute(app: OpenAPIHono) {
  app.get(ROUTES.GET_SHARED_RECIPE, async (c) => {
    const shareId = c.req.param('shareId') as string;
    const dynamoClient = c.get('dynamoDBClient');

    try {
      const recipe = await getSharedRecipe(dynamoClient, shareId);
      return c.json(recipe, 200);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return c.json({ error: 'Recipe not found' }, 404);
      }
      console.error('Error getting shared recipe:', error);
      return c.json({ error: 'Failed to fetch shared recipe' }, 500);
    }
  });
}
