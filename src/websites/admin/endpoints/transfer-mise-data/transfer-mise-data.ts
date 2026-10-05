import { z } from '@hono/zod-openapi';
import { AdminContext } from '@core/types/context.js';
import {
  getAllRecipesForUser,
  getMealPlanForUser,
  putMealPlanForUser,
  updateRecipe,
} from '@core/dynamodb/utilities.js';
import { copyS3Object } from '@core/s3/utilities.js';
import { IRecipe } from '@core/types/recipes.js';
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

/**
 * Copies recipes (and their images) from one user to another, keeping recipe UUIDs so that
 * re-running a transfer overwrites the earlier copies rather than duplicating them.
 * The source user's data is never modified.
 */
export async function transferMiseData(
  c: AdminContext,
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

  let imagesCopied = 0;
  for (const recipe of recipes) {
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
    const copiedUuids = new Set(recipes.map((recipe) => recipe.uuid));
    const mealPlan = await getMealPlanForUser(dynamoClient.client, fromUserId);
    await putMealPlanForUser(
      dynamoClient.client,
      toUserId,
      mealPlan.map((day) => ({
        ...day,
        plan: day.plan.filter((entry) => copiedUuids.has(entry.recipeId)),
      }))
    );
  }

  logger.info(
    `Admin ${c.get('adminEmail')} copied ${recipes.length} recipes and ${imagesCopied} images from ${fromUserId} to ${toUserId}${includeMealPlan ? ' (with meal plan)' : ''}`
  );

  return {
    status: 200,
    body: { recipesCopied: recipes.length, imagesCopied, mealPlanCopied: includeMealPlan },
  };
}
