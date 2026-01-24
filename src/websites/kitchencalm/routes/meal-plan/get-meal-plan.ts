import { OpenAPIHono } from '@hono/zod-openapi';
import { cognitoAuthMiddleware } from '@core/middleware/cognito-auth.js';
import { getMealPlanForUser } from '../../utils/dynamo.js';
import { ROUTES } from '../paths.js';
import { CognitoUser } from '@core/middleware/cognito-auth.js';

export function registerGetMealPlanRoute(app: OpenAPIHono) {
  app.get(ROUTES.GET_MEAL_PLAN, cognitoAuthMiddleware, async (c) => {
    const user = c.get('cognitoUser') as CognitoUser;
    const dynamoClient = c.get('dynamoDBClient');

    try {
      const mealPlan = await getMealPlanForUser(dynamoClient, user.userId);
      return c.json(mealPlan, 200);
    } catch (error) {
      console.error('Error getting meal plan:', error);
      return c.json({ error: 'Failed to fetch meal plan' }, 500);
    }
  });
}
