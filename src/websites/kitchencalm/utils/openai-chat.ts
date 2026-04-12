import OpenAI from 'openai';
import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import type { ChatMessage } from '../endpoints/chat/chat.js';
import { getRecipes } from '../endpoints/get-recipes/get-recipes.js';
import { getMealPlan } from '../endpoints/get-meal-plan/get-meal-plan.js';
import {
  getShoppingList,
  GetShoppingListRequestSchema,
} from '../endpoints/get-shopping-list/get-shopping-list.js';
import {
  updateMealPlan,
  UpdateMealPlanRequestSchema,
} from '../endpoints/update-meal-plan/update-meal-plan.js';
import {
  updateRecipe,
  UpdateRecipeRequestSchema,
} from '../endpoints/update-recipe/update-recipe.js';
import {
  deleteRecipe,
  DeleteRecipeRequestSchema,
} from '../endpoints/delete-recipe/delete-recipe.js';
import {
  searchRecipesHandler,
  SearchRecipesRequestSchema,
} from '../endpoints/search-recipes/search-recipes.js';

const SYSTEM_PROMPT =
  'You are a helpful cooking assistant for KitchenCalm. ' +
  'You help users discover recipes, plan meals, find cooking techniques, and answer food-related questions. ' +
  "You have tools to read and manage the user's saved recipes and meal plan. " +
  'Use web search when asked to find new recipes or cooking information from the internet. ' +
  'Be practical and concise in your responses.';

const MAX_TOOL_ITERATIONS = 10;

// OpenAI function tool definitions derived from existing Zod schemas
const RECIPE_TOOLS: OpenAI.Responses.Tool[] = [
  {
    type: 'function',
    name: 'get_recipes',
    description: 'Get all recipes saved by the authenticated user',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_meal_plan',
    description: 'Get the meal plan for the authenticated user',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_shopping_list',
    description:
      'Get aggregated shopping list from recipes in the meal plan, optionally filtered by specific dates',
    parameters: z.toJSONSchema(GetShoppingListRequestSchema),
    strict: false,
  },
  {
    type: 'function',
    name: 'search_recipes',
    description:
      "Search the user's saved recipes by name, description, ingredients, or instructions",
    parameters: z.toJSONSchema(SearchRecipesRequestSchema),
    strict: false,
  },
  {
    type: 'function',
    name: 'update_recipe',
    description: 'Create or update a recipe for the authenticated user',
    parameters: z.toJSONSchema(UpdateRecipeRequestSchema),
    strict: false,
  },
  {
    type: 'function',
    name: 'delete_recipe',
    description: 'Delete a recipe for the authenticated user',
    parameters: z.toJSONSchema(DeleteRecipeRequestSchema),
    strict: false,
  },
  {
    type: 'function',
    name: 'update_meal_plan',
    description: 'Replace the meal plan for the authenticated user',
    parameters: z.toJSONSchema(UpdateMealPlanRequestSchema),
    strict: false,
  },
];

async function dispatchTool(name: string, args: unknown, c: ContextWithUserId): Promise<unknown> {
  switch (name) {
    case 'get_recipes':
      return getRecipes(c);
    case 'get_meal_plan':
      return getMealPlan(c);
    case 'get_shopping_list':
      return getShoppingList(c, GetShoppingListRequestSchema.parse(args));
    case 'search_recipes':
      return searchRecipesHandler(c, SearchRecipesRequestSchema.parse(args));
    case 'update_recipe':
      return updateRecipe(c, UpdateRecipeRequestSchema.parse(args));
    case 'delete_recipe': {
      const { uuid } = DeleteRecipeRequestSchema.parse(args);
      return deleteRecipe(c, uuid);
    }
    case 'update_meal_plan':
      return updateMealPlan(c, UpdateMealPlanRequestSchema.parse(args));
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function callOpenAIChat(
  apiKey: string,
  messages: ChatMessage[],
  c: ContextWithUserId
): Promise<string> {
  const openai = new OpenAI({ apiKey });

  // Accumulate input items across iterations
  const inputItems: object[] = messages.map((m) => ({ role: m.role, content: m.content }));

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await openai.responses.create({
      model: 'gpt-4o',
      instructions: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_preview' }, ...RECIPE_TOOLS],
      input: inputItems as OpenAI.Responses.ResponseInput,
    });

    // Filter for custom function calls only (web_search_preview is handled automatically)
    const functionCalls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === 'function_call'
    );

    if (functionCalls.length === 0) {
      return response.output_text;
    }

    // Append response output to input (model needs to see its own tool call items)
    inputItems.push(...(response.output as object[]));

    // Execute all function calls and append results
    const toolResults = await Promise.all(
      functionCalls.map(async (call) => {
        const args: unknown = JSON.parse(call.arguments);
        const result = await dispatchTool(call.name, args, c);
        return {
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(result),
        };
      })
    );

    inputItems.push(...toolResults);
  }

  throw new Error('Chat exceeded maximum tool call iterations');
}
