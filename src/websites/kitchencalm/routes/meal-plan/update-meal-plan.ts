import { z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cognitoAuthMiddleware } from '@core/middleware/cognito-auth.js';
import { putMealPlanForUser } from '../../utils/dynamo.js';
import { mealPlanSchema } from '../../validators/index.js';
import { ROUTES } from '../paths.js';
import { CognitoUser } from '@core/middleware/cognito-auth.js';

export function registerUpdateMealPlanRoute(app: OpenAPIHono) {
  app.put(ROUTES.UPDATE_MEAL_PLAN, cognitoAuthMiddleware, async (c) => {
    const user = c.get('cognitoUser') as CognitoUser;
    const dynamoClient = c.get('dynamoDBClient');

    try {
      const body = await c.req.json();
      const { mealPlan } = body;

      // Validate meal plan data
      const validatedMealPlan = mealPlanSchema.parse(mealPlan);

      await putMealPlanForUser(dynamoClient, user.userId, validatedMealPlan);

      return c.json({ success: true }, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid meal plan data' }, 400);
      }
      console.error('Error updating meal plan:', error);
      return c.json({ error: 'Failed to update meal plan' }, 500);
    }
  });
}
