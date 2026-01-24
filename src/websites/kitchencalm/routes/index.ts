import { OpenAPIHono } from '@hono/zod-openapi';

// Recipe routes
import { registerGetRecipesRoute } from './recipes/get-recipes.js';
import { registerUpdateRecipeRoute } from './recipes/update-recipe.js';
import { registerDeleteRecipeRoute } from './recipes/delete-recipe.js';
import { registerCreateSharedRecipeRoute } from './recipes/create-shared-recipe.js';
import { registerGetSharedRecipeRoute } from './recipes/get-shared-recipe.js';

// Meal Plan routes
import { registerGetMealPlanRoute } from './meal-plan/get-meal-plan.js';
import { registerUpdateMealPlanRoute } from './meal-plan/update-meal-plan.js';

// Storage routes
import { registerGetSignedUrlRoute } from './storage/get-signed-url.js';
import { registerDeleteStorageRoute } from './storage/delete-object.js';
import { registerGetSignedPutUrlRoute } from './storage/get-signed-put-url.js';

export function registerKitchenCalmRoutes(app: OpenAPIHono) {
  // Recipes
  registerGetRecipesRoute(app);
  registerUpdateRecipeRoute(app);
  registerDeleteRecipeRoute(app);
  registerCreateSharedRecipeRoute(app);
  registerGetSharedRecipeRoute(app);

  // Meal Plan
  registerGetMealPlanRoute(app);
  registerUpdateMealPlanRoute(app);

  // Storage
  registerGetSignedUrlRoute(app);
  registerDeleteStorageRoute(app);
  registerGetSignedPutUrlRoute(app);
}
