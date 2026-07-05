import Anthropic from '@anthropic-ai/sdk';
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

const MODEL = 'claude-sonnet-5';
const MAX_TOOL_ITERATIONS = 8;

const SYSTEM_PROMPT = `You are Chef, the cooking assistant built into Mise, a recipe and meal-planning app.

You can:
- Search the web and fetch recipe pages to find recipes for the user.
- Search the user's own saved recipes.
- Save a recipe to the user's collection.
- Add or remove a recipe from the user's meal plan for a given date.

Whenever you want to show the user a specific recipe (one you found online, or one of their own), call the show_recipe tool with the full structured recipe instead of writing it out in the chat text. You can still write a short conversational sentence alongside it. Do not fabricate ingredients or steps you did not actually find — if you're not confident in the details, say so.

To add or remove a recipe from the meal plan it must already be saved (it needs a UUID) — save it first if it came from the web or wasn't already one of the user's recipes.

Keep your text replies short and conversational. Dates for the meal plan must be in YYYY-MM-DD format.`;

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

function tool(name: string, description: string, schema: z.ZodTypeAny): Anthropic.Tool {
  return {
    name,
    description,
    input_schema: z.toJSONSchema(schema) as unknown as Anthropic.Tool.InputSchema,
  };
}

const TOOLS: Anthropic.ToolUnion[] = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 4 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4, max_content_tokens: 8000 },
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

function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content.map((block): Anthropic.TextBlockParam => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      // Recipes shown in earlier turns are re-described as text so Claude keeps
      // context without needing to re-emit a show_recipe call for them.
      return {
        type: 'text',
        text: `[Previously shown recipe: ${block.recipe.name} — ${block.recipe.description}]`,
      };
    }),
  }));
}

async function executeTool(
  c: ContextWithUserId,
  name: string,
  rawInput: unknown
): Promise<{ output: string; recipeShown?: ChatContentBlock }> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  switch (name) {
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

function isTextBlock(block: Anthropic.ContentBlock): block is Anthropic.TextBlock {
  return block.type === 'text';
}

function isToolUseBlock(block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock {
  return block.type === 'tool_use';
}

export async function runChatAgent(
  c: ContextWithUserId,
  client: Anthropic,
  history: ChatMessage[]
): Promise<ChatMessage> {
  const messages = toAnthropicMessages(history);
  const shownRecipes: ChatContentBlock[] = [];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      tools: TOOLS,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolUseBlocks = response.content.filter(isToolUseBlock);

    if (response.stop_reason !== 'tool_use' && response.stop_reason !== 'pause_turn') {
      const text = response.content
        .filter(isTextBlock)
        .map((block) => block.text)
        .join('\n\n');

      const content: ChatContentBlock[] = [];
      if (text) content.push({ type: 'text', text });
      content.push(...shownRecipes);
      if (content.length === 0) {
        content.push({
          type: 'text',
          text: "Sorry, I wasn't able to come up with anything — could you try rephrasing?",
        });
      }
      return { role: 'assistant', content };
    }

    if (toolUseBlocks.length === 0) {
      // pause_turn with no client-side tool calls (a server tool hit its round limit) —
      // resend as-is so the API resumes where it left off.
      continue;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      try {
        const { output, recipeShown } = await executeTool(c, block.name, block.input);
        if (recipeShown) shownRecipes.push(recipeShown);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: output });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: message,
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });
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
