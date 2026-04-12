import { OpenAPIHono } from '@hono/zod-openapi';
import { McpTool, createMcpTool } from '@core/mcp/sse.js';
import { ContextWithUserId } from '@core/types/context.js';
import { authToken } from './endpoints/auth-token/auth-token.js';
import { authTokenRoute } from './endpoints/auth-token/auth-token-definition.js';
import { getRecipes } from './endpoints/get-recipes/get-recipes.js';
import { getRecipesRoute } from './endpoints/get-recipes/get-recipes-definition.js';
import { updateRecipe } from './endpoints/update-recipe/update-recipe.js';
import { deleteRecipe } from './endpoints/delete-recipe/delete-recipe.js';
import { deleteRecipeRoute } from './endpoints/delete-recipe/delete-recipe-definition.js';
import { getMealPlan } from './endpoints/get-meal-plan/get-meal-plan.js';
import { getMealPlanRoute } from './endpoints/get-meal-plan/get-meal-plan-definition.js';
import { updateMealPlan } from './endpoints/update-meal-plan/update-meal-plan.js';
import { updateMealPlanRoute } from './endpoints/update-meal-plan/update-meal-plan-definition.js';
import { getSignedUrl } from './endpoints/s3-get-signed-url/s3-get-signed-url.js';
import { s3GetSignedUrlRoute } from './endpoints/s3-get-signed-url/s3-get-signed-url-definition.js';
import { putSignedUrl } from './endpoints/s3-put-signed-url/s3-put-signed-url.js';
import { s3PutSignedUrlRoute } from './endpoints/s3-put-signed-url/s3-put-signed-url-definition.js';
import { deleteFile } from './endpoints/s3-delete/s3-delete.js';
import { s3DeleteRoute } from './endpoints/s3-delete/s3-delete-definition.js';
import {
  getShoppingList,
  getShoppingListMcp,
  GetShoppingListRequestSchema,
  GetShoppingListMcpSchema,
} from './endpoints/get-shopping-list/get-shopping-list.js';
import { getShoppingListRoute } from './endpoints/get-shopping-list/get-shopping-list-definition.js';
import { GetMealPlanResponseSchema } from './endpoints/get-meal-plan/get-meal-plan.js';
import { z } from 'zod';
import {
  UpdateMealPlanRequestSchema,
  UpdateMealPlanResponseSchema,
} from './endpoints/update-meal-plan/update-meal-plan.js';
import {
  UpdateRecipeRequestSchema,
  UpdateRecipeResponseSchema,
} from './endpoints/update-recipe/update-recipe.js';
import {
  DeleteRecipeRequestSchema,
  DeleteRecipeResponseSchema,
} from './endpoints/delete-recipe/delete-recipe.js';
import { searchRecipesHandler } from './endpoints/search-recipes/search-recipes.js';
import { searchRecipesRoute } from './endpoints/search-recipes/search-recipes-definition.js';
import {
  SearchRecipesRequestSchema,
  SearchRecipesResponseSchema,
} from './endpoints/search-recipes/search-recipes.js';
import { parseRecipe } from './endpoints/parse-recipe/parse-recipe.js';
import { parseRecipeRoute } from './endpoints/parse-recipe/parse-recipe-definition.js';
import { getOpenAIKeyStatus } from './endpoints/openai-key/get-openai-key-status.js';
import { getOpenAIKeyStatusRoute } from './endpoints/openai-key/get-openai-key-status-definition.js';
import { putOpenAIKey } from './endpoints/openai-key/put-openai-key.js';
import { putOpenAIKeyRoute } from './endpoints/openai-key/put-openai-key-definition.js';
import { deleteOpenAIKey } from './endpoints/openai-key/delete-openai-key.js';
import { deleteOpenAIKeyRoute } from './endpoints/openai-key/delete-openai-key-definition.js';
import { chat } from './endpoints/chat/chat.js';
import { chatRoute } from './endpoints/chat/chat-definition.js';

export const tools: McpTool<any, any>[] = [
  {
    name: 'get_recipes',
    description: 'Get all recipes for the authenticated user',
    handler: getRecipes,
  },
  createMcpTool(
    'get_meal_plan',
    'Get the meal plan for the authenticated user',
    z.object({}),
    getMealPlan,
    GetMealPlanResponseSchema
  ),
  createMcpTool(
    'get_shopping_list',
    'Get aggregated shopping list from recipes in the meal plan, optionally filtered by specific dates',
    GetShoppingListRequestSchema,
    getShoppingListMcp,
    GetShoppingListMcpSchema
  ),
  createMcpTool(
    'update_meal_plan',
    'Update the meal plan for the authenticated user',
    UpdateMealPlanRequestSchema,
    updateMealPlan,
    UpdateMealPlanResponseSchema
  ),
  createMcpTool(
    'update_recipe',
    'Create or update a recipe for the authenticated user',
    UpdateRecipeRequestSchema,
    updateRecipe,
    UpdateRecipeResponseSchema
  ),
  createMcpTool(
    'delete_recipe',
    'Delete a recipe for the authenticated user',
    DeleteRecipeRequestSchema,
    async (c, input) => deleteRecipe(c, input.uuid),
    DeleteRecipeResponseSchema
  ),
  createMcpTool(
    'search_recipes',
    'Search recipes by name, description, ingredients, or instructions',
    SearchRecipesRequestSchema,
    searchRecipesHandler,
    SearchRecipesResponseSchema
  ),
];

export function registerRoutes(app: OpenAPIHono) {
  app.openapi(authTokenRoute, async (c) => {
    const userId = (c as ContextWithUserId).get('userId');
    const result = await authToken(userId);
    return c.json(result, 200);
  });

  app.openapi(getRecipesRoute, async (c) => {
    const result = await getRecipes(c as ContextWithUserId);
    return c.json(result, 200);
  });

  app.openapi(searchRecipesRoute, async (c) => {
    const query = c.req.valid('query');
    const result = await searchRecipesHandler(c as ContextWithUserId, query);
    return c.json(result, 200);
  });

  app.openapi(deleteRecipeRoute, async (c) => {
    const { uuid } = c.req.valid('param');
    const result = await deleteRecipe(c as ContextWithUserId, uuid);
    return c.json(result, 200);
  });

  app.openapi(getMealPlanRoute, async (c) => {
    const result = await getMealPlan(c as ContextWithUserId);
    return c.json(result, 200);
  });

  app.openapi(getShoppingListRoute, async (c) => {
    const { dates } = c.req.valid('query');
    const result = await getShoppingList(c as ContextWithUserId, { dates });
    return c.json(result, 200);
  });

  app.openapi(updateMealPlanRoute, async (c) => {
    const mealPlan = c.req.valid('json');
    const result = await updateMealPlan(c as ContextWithUserId, mealPlan);
    return c.json(result, 200);
  });

  app.openapi(s3GetSignedUrlRoute, async (c) => {
    const { key } = c.req.valid('json');
    const result = await getSignedUrl(c as ContextWithUserId, key);
    return c.json(result, 200);
  });

  app.openapi(s3PutSignedUrlRoute, async (c) => {
    const { fileName, contentType } = c.req.valid('json');
    const result = await putSignedUrl(c as ContextWithUserId, fileName, contentType);
    return c.json(result, 200);
  });

  app.openapi(s3DeleteRoute, async (c) => {
    const { key } = c.req.valid('json');
    const result = await deleteFile(c as ContextWithUserId, key);
    return c.json(result, 200);
  });

  app.openapi(parseRecipeRoute, async (c) => {
    const input = c.req.valid('json');
    const result = await parseRecipe(c as ContextWithUserId, input);
    return c.json(result, 200);
  });

  app.openapi(getOpenAIKeyStatusRoute, async (c) => {
    const result = await getOpenAIKeyStatus(c as ContextWithUserId);
    return c.json(result, 200);
  });

  app.openapi(putOpenAIKeyRoute, async (c) => {
    const input = c.req.valid('json');
    const result = await putOpenAIKey(c as ContextWithUserId, input);
    return c.json(result, 200);
  });

  app.openapi(deleteOpenAIKeyRoute, async (c) => {
    const result = await deleteOpenAIKey(c as ContextWithUserId);
    return c.json(result, 200);
  });

  app.openapi(chatRoute, async (c) => {
    const input = c.req.valid('json');
    const result = await chat(c as ContextWithUserId, input);
    switch (result.status) {
      case 200:
        return c.json(result.body, 200);
      case 400:
        return c.json(result.body, 400);
    }
  });
}
