import { z } from '@hono/zod-openapi';
import { Context } from 'hono';
import { getAllRecipesForUser, getMealPlanForUser } from '@core/dynamodb/utilities.js';
import { getSignedGetUrl } from '@core/s3/utilities.js';
import { logger } from '@core/telemetry/logger.js';
import { MealPlanSchema, RecipeSchema } from '@websites/mise/schemas.js';

export const GetMiseUserResponseSchema = z.object({
  userId: z.string().describe('Cognito user ID (sub)'),
  recipes: z.array(RecipeSchema).describe('Recipes owned by the user, sorted by name'),
  mealPlan: MealPlanSchema.describe('Stored meal plan, exactly as saved'),
});

export type GetMiseUserResponse = z.infer<typeof GetMiseUserResponseSchema>;

export async function getMiseUser(c: Context, userId: string): Promise<GetMiseUserResponse> {
  const dynamoClient = c.get('dynamoClient');
  const s3Client = c.get('s3Client');

  const [recipes, mealPlan] = await Promise.all([
    getAllRecipesForUser(dynamoClient.client, userId),
    getMealPlanForUser(dynamoClient.client, userId),
  ]);

  const recipesWithImageUrls = await Promise.all(
    recipes.map(async (recipe) => ({
      ...recipe,
      images: await Promise.all(
        (recipe.images ?? []).map(async (image) => ({
          ...image,
          presignedUrl: await getSignedGetUrl(s3Client.client, image.key).catch((error) => {
            logger.warn(`Failed to generate presigned URL for image ${image.key}:`, error);
            return undefined;
          }),
        }))
      ),
    }))
  );

  return {
    userId,
    recipes: recipesWithImageUrls.sort((a, b) => a.name.localeCompare(b.name)),
    mealPlan: [...mealPlan].sort((a, b) => a.date - b.date),
  };
}
