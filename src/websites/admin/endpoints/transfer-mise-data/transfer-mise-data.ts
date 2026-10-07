import { z } from '@hono/zod-openapi';
import { Context } from 'hono';
import {
  getAllRecipesForUser,
  getMealPlanForUser,
  putMealPlanForUser,
  updateRecipe,
} from '@core/dynamodb/utilities.js';
import { copyS3Object } from '@core/s3/utilities.js';
import { IRecipe } from '@core/types/recipes.js';
import { IMealPlanRecipe } from '@core/types/meal-plan.js';
import { logger } from '@core/telemetry/logger.js';

export const TransferMiseDataRequestSchema = z.object({
  fromUserId: z.string().min(1).describe('Cognito user ID to copy data from'),
  toUserId: z.string().min(1).describe('Cognito user ID to copy data to'),
  recipeUuids: z
    .array(z.string().uuid())
    .optional()
    .describe('Recipes to copy; omit to copy every recipe'),
  includeMealPlan: z
    .boolean()
    .default(false)
    .describe("Replace the target's meal plan with the source's (limited to copied recipes)"),
});

export type TransferMiseDataRequest = z.infer<typeof TransferMiseDataRequestSchema>;

export const TransferMiseDataResponseSchema = z.object({
  recipesCopied: z.number().describe('Number of recipes written to the target user'),
  imagesCopied: z.number().describe('Number of S3 images copied to the target user'),
  mealPlanCopied: z.boolean().describe("Whether the target's meal plan was replaced"),
  skippedRecipes: z
    .array(z.string())
    .describe('Names of recipes not copied because the target already has a recipe with that name'),
});

export type TransferMiseDataResponse = z.infer<typeof TransferMiseDataResponseSchema>;

export type TransferMiseDataResult =
  | { status: 200; body: TransferMiseDataResponse }
  | { status: 400; body: { error: string } }
  | { status: 404; body: { error: string } };

export function rewriteImageKey(key: string, fromUserId: string, toUserId: string): string {
  const sourcePrefix = `${fromUserId}/`;
  const fileName = key.startsWith(sourcePrefix) ? key.slice(sourcePrefix.length) : key;
  return `${toUserId}/${fileName}`;
}

export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Points a meal plan entry at the target's own copy of a recipe, matching components by name
function remapMealPlanEntry(
  entry: IMealPlanRecipe,
  source: IRecipe,
  target: IRecipe
): IMealPlanRecipe {
  const targetComponentsByName = new Map(
    target.components.map((component) => [normaliseName(component.name), component.uuid])
  );
  return {
    recipeId: target.uuid,
    components: entry.components.flatMap((planned) => {
      const sourceComponent = source.components.find((c) => c.uuid === planned.componentId);
      const componentId =
        sourceComponent && targetComponentsByName.get(normaliseName(sourceComponent.name));
      return componentId ? [{ ...planned, componentId }] : [];
    }),
  };
}

/**
 * Copies recipes (and their images) from one user to another, skipping any recipe the target
 * already has a recipe with the same name for, so re-running a transfer never duplicates recipes.
 * The source user's data is never modified.
 */
export async function transferMiseData(
  c: Context,
  request: TransferMiseDataRequest
): Promise<TransferMiseDataResult> {
  const { fromUserId, toUserId, recipeUuids, includeMealPlan } = request;
  const dynamoClient = c.get('dynamoClient');
  const s3Client = c.get('s3Client');

  if (fromUserId === toUserId) {
    return { status: 400, body: { error: 'Source and target users must be different' } };
  }

  const sourceRecipes = await getAllRecipesForUser(dynamoClient.client, fromUserId);
  let recipes: IRecipe[] = sourceRecipes;
  if (recipeUuids) {
    const requested = new Set(recipeUuids);
    recipes = sourceRecipes.filter((recipe) => requested.has(recipe.uuid));
    const found = new Set(recipes.map((recipe) => recipe.uuid));
    const missing = recipeUuids.filter((uuid) => !found.has(uuid));
    if (missing.length > 0) {
      return {
        status: 404,
        body: { error: `Recipes not found for source user: ${missing.join(', ')}` },
      };
    }
  }

  // Recipes were originally duplicated between accounts by hand, so a matching name means the
  // target already has the recipe even though its UUID differs
  const targetRecipes = await getAllRecipesForUser(dynamoClient.client, toUserId);
  const targetByName = new Map(targetRecipes.map((recipe) => [normaliseName(recipe.name), recipe]));
  const matchedRecipes = new Map<string, IRecipe>();
  const recipesToCopy: IRecipe[] = [];
  for (const recipe of recipes) {
    const existing = targetByName.get(normaliseName(recipe.name));
    if (existing) {
      matchedRecipes.set(recipe.uuid, existing);
    } else {
      recipesToCopy.push(recipe);
      targetByName.set(normaliseName(recipe.name), recipe);
    }
  }

  let imagesCopied = 0;
  for (const recipe of recipesToCopy) {
    // Copy images before writing the recipe so the target never references a missing object
    const images = await Promise.all(
      (recipe.images ?? []).map(async ({ presignedUrl: _presignedUrl, ...image }) => {
        const key = rewriteImageKey(image.key, fromUserId, toUserId);
        await copyS3Object(s3Client.client, image.key, key);
        imagesCopied++;
        return { ...image, key };
      })
    );
    await updateRecipe(dynamoClient.client, toUserId, { ...recipe, images });
  }

  if (includeMealPlan) {
    const sourceByUuid = new Map(recipes.map((recipe) => [recipe.uuid, recipe]));
    const mealPlan = await getMealPlanForUser(dynamoClient.client, fromUserId);
    await putMealPlanForUser(
      dynamoClient.client,
      toUserId,
      mealPlan.map((day) => ({
        ...day,
        plan: day.plan.flatMap((entry) => {
          const source = sourceByUuid.get(entry.recipeId);
          if (!source) return [];
          const match = matchedRecipes.get(entry.recipeId);
          return match ? [remapMealPlanEntry(entry, source, match)] : [entry];
        }),
      }))
    );
  }

  logger.info(
    `Admin copied ${recipesToCopy.length} recipes (skipped ${matchedRecipes.size} already present) and ${imagesCopied} images from ${fromUserId} to ${toUserId}${includeMealPlan ? ' (with meal plan)' : ''}`
  );

  return {
    status: 200,
    body: {
      recipesCopied: recipesToCopy.length,
      imagesCopied,
      mealPlanCopied: includeMealPlan,
      skippedRecipes: Array.from(matchedRecipes.values(), (recipe) => recipe.name),
    },
  };
}
