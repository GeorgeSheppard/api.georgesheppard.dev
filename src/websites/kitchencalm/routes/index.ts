import { OpenAPIHono } from '@hono/zod-openapi';
import { registerGetRecipesRoute } from './recipes/get-recipes.js';

export function registerKitchenCalmRoutes(app: OpenAPIHono) {
  registerGetRecipesRoute(app);
}
