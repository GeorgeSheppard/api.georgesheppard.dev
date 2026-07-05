import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import {
  getRecipeByUuid,
  getMealPlanForUser,
  putMealPlanForUser,
  updateRecipe as updateRecipeInDynamo,
} from '@core/dynamodb/utilities.js';
import { IRecipe } from '@core/types/recipes.js';
import { searchRecipesHandler } from '../endpoints/search-recipes/search-recipes.js';
import { ChatMessage, ChatContentBlock, OpenAIRecipeSchema } from '../schemas.js';
import {
  addRecipeToMealPlan,
  removeRecipeFromMealPlan,
  parseMealPlanDate,
} from './meal-plan-utils.js';

const MODEL = 'gpt-4.1';
const MAX_TOOL_ITERATIONS = 8;
const MAX_FETCHED_PAGE_CHARS = 12000;

const SYSTEM_PROMPT = `You are Chef, the cooking assistant built into Mise, a recipe and meal-planning app.

You can:
- Search the web to find recipes, and fetch a specific page's content with fetch_url (e.g. a recipe page turned up by search).
- Search the user's own saved recipes.
- Save a recipe to the user's collection.
- Add or remove a recipe from the user's meal plan for a given date.

Whenever you want to show the user a specific recipe (one you found online, or one of their own), call the show_recipe tool with the full structured recipe instead of writing it out in the chat text. You can still write a short conversational sentence alongside it. Do not fabricate ingredients or steps you did not actually find — if you're not confident in the details, say so.

To add or remove a recipe from the meal plan it must already be saved (it needs a UUID) — save it first if it came from the web or wasn't already one of the user's recipes.

Keep your text replies short and conversational. Dates for the meal plan must be in YYYY-MM-DD format.`;

const FetchUrlInputSchema = z.object({
  url: z.string().url().describe('URL of the page to fetch, e.g. a recipe page found via search'),
});

const SearchMyRecipesInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Search text to match against the name/description/ingredients/instructions'),
});

const ShowRecipeInputSchema = z.object({
  recipe: OpenAIRecipeSchema,
  sourceUrl: z.string().url().optional().describe('URL this recipe was found at, if any'),
});

const SaveRecipeInputSchema = z.object({
  recipe: OpenAIRecipeSchema,
});

const AddToMealPlanInputSchema = z.object({
  recipeUuid: z.string().uuid().describe('UUID of a recipe already saved to the user collection'),
  date: z.string().describe('Date in YYYY-MM-DD format'),
  servings: z
    .number()
    .optional()
    .describe('Servings to plan; defaults to each component default servings'),
});

const RemoveFromMealPlanInputSchema = z.object({
  recipeUuid: z.string().uuid(),
  date: z.string().describe('Date in YYYY-MM-DD format'),
});

function tool(
  name: string,
  description: string,
  schema: z.ZodTypeAny
): OpenAI.Responses.FunctionTool {
  return {
    type: 'function',
    name,
    description,
    parameters: z.toJSONSchema(schema) as Record<string, unknown>,
    strict: false,
  };
}

const TOOLS: OpenAI.Responses.Tool[] = [
  { type: 'web_search_preview' },
  tool(
    'fetch_url',
    "Fetch a web page's text content, e.g. to read a specific recipe page found via web search",
    FetchUrlInputSchema
  ),
  tool(
    'search_my_recipes',
    "Search the user's own saved recipes by name, description or ingredients",
    SearchMyRecipesInputSchema
  ),
  tool('show_recipe', 'Show a structured recipe to the user in the chat UI', ShowRecipeInputSchema),
  tool(
    'save_recipe',
    "Save a recipe to the user's collection so it can be edited or added to their meal plan",
    SaveRecipeInputSchema
  ),
  tool(
    'add_recipe_to_meal_plan',
    "Add a saved recipe to the user's meal plan on a given date",
    AddToMealPlanInputSchema
  ),
  tool(
    'remove_recipe_from_meal_plan',
    "Remove a recipe from the user's meal plan on a given date",
    RemoveFromMealPlanInputSchema
  ),
];

function toResponseInput(messages: ChatMessage[]): OpenAI.Responses.EasyInputMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
      .map((block) =>
        block.type === 'text'
          ? block.text
          : // Recipes shown in earlier turns are re-described as text so the model keeps
            // context without needing to re-emit a show_recipe call for them.
            `[Previously shown recipe: ${block.recipe.name} — ${block.recipe.description}]`
      )
      .join('\n\n'),
  }));
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function executeTool(
  c: ContextWithUserId,
  name: string,
  rawArguments: string
): Promise<{ output: string; recipeShown?: ChatContentBlock }> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');
  const rawInput: unknown = JSON.parse(rawArguments);

  switch (name) {
    case 'fetch_url': {
      const input = FetchUrlInputSchema.parse(rawInput);
      const response = await fetch(input.url);
      if (!response.ok) {
        return { output: `Failed to fetch ${input.url}: HTTP ${response.status}` };
      }
      const html = await response.text();
      return { output: htmlToPlainText(html).slice(0, MAX_FETCHED_PAGE_CHARS) };
    }
    case 'search_my_recipes': {
      const input = SearchMyRecipesInputSchema.parse(rawInput);
      const result = await searchRecipesHandler(c, {
        q: input.query,
        fields: 'name,description,ingredients,instructions',
      });
      return { output: JSON.stringify(result.results) };
    }
    case 'show_recipe': {
      const input = ShowRecipeInputSchema.parse(rawInput);
      return {
        output: 'Recipe shown to the user.',
        recipeShown: {
          type: 'recipe',
          recipe: { ...input.recipe, sourceUrl: input.sourceUrl },
        },
      };
    }
    case 'save_recipe': {
      const input = SaveRecipeInputSchema.parse(rawInput);
      const recipeUuid = uuidv4();
      const recipeToStore: IRecipe = {
        uuid: recipeUuid,
        name: input.recipe.name,
        description: input.recipe.description,
        images: [],
        components: input.recipe.components.map((component) => ({
          ...component,
          uuid: uuidv4(),
        })),
      };
      await updateRecipeInDynamo(dynamoClient.client, userId, recipeToStore);
      return { output: JSON.stringify({ uuid: recipeUuid, success: true }) };
    }
    case 'add_recipe_to_meal_plan': {
      const input = AddToMealPlanInputSchema.parse(rawInput);
      const recipe = await getRecipeByUuid(dynamoClient.client, userId, input.recipeUuid);
      if (!recipe) {
        return { output: `No saved recipe found with uuid ${input.recipeUuid}. Save it first.` };
      }
      const mealPlan = await getMealPlanForUser(dynamoClient.client, userId);
      const date = parseMealPlanDate(input.date);
      const updated = addRecipeToMealPlan(mealPlan, recipe, date, input.servings);
      await putMealPlanForUser(dynamoClient.client, userId, updated);
      return { output: JSON.stringify({ success: true }) };
    }
    case 'remove_recipe_from_meal_plan': {
      const input = RemoveFromMealPlanInputSchema.parse(rawInput);
      const mealPlan = await getMealPlanForUser(dynamoClient.client, userId);
      const date = parseMealPlanDate(input.date);
      const updated = removeRecipeFromMealPlan(mealPlan, input.recipeUuid, date);
      await putMealPlanForUser(dynamoClient.client, userId, updated);
      return { output: JSON.stringify({ success: true }) };
    }
    default:
      return { output: `Unknown tool ${name}` };
  }
}

function isFunctionCall(
  item: OpenAI.Responses.ResponseOutputItem
): item is OpenAI.Responses.ResponseFunctionToolCall {
  return item.type === 'function_call';
}

export async function runChatAgent(
  c: ContextWithUserId,
  client: OpenAI,
  history: ChatMessage[]
): Promise<ChatMessage> {
  const input: OpenAI.Responses.ResponseInputItem[] = toResponseInput(history);
  const shownRecipes: ChatContentBlock[] = [];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await client.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      tools: TOOLS,
      input,
    });

    const functionCalls = response.output.filter(isFunctionCall);

    if (functionCalls.length === 0) {
      const content: ChatContentBlock[] = [];
      if (response.output_text) content.push({ type: 'text', text: response.output_text });
      content.push(...shownRecipes);
      if (content.length === 0) {
        content.push({
          type: 'text',
          text: "Sorry, I wasn't able to come up with anything — could you try rephrasing?",
        });
      }
      return { role: 'assistant', content };
    }

    input.push(...response.output);

    for (const call of functionCalls) {
      try {
        const { output, recipeShown } = await executeTool(c, call.name, call.arguments);
        if (recipeShown) shownRecipes.push(recipeShown);
        input.push({ type: 'function_call_output', call_id: call.call_id, output });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        input.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify({ error: message }),
        });
      }
    }
  }

  return {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: "I've been working on this for a while — could you narrow down what you'd like?",
      },
      ...shownRecipes,
    ],
  };
}
