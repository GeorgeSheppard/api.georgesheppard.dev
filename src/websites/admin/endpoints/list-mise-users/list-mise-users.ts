import { z } from '@hono/zod-openapi';
import { AdminContext } from '@core/types/context.js';
import { scanAllItemKeys } from '@core/dynamodb/utilities.js';

export const MiseUserSummarySchema = z
  .object({
    userId: z.string().describe('Cognito user ID (sub)'),
    recipeCount: z.number().describe('Number of recipes owned by the user'),
    hasMealPlan: z.boolean().describe('Whether the user has a saved meal plan'),
  })
  .openapi('AdminMiseUserSummary');

export const ListMiseUsersResponseSchema = z.object({
  users: z.array(MiseUserSummarySchema),
});

export type ListMiseUsersResponse = z.infer<typeof ListMiseUsersResponseSchema>;

export async function listMiseUsers(c: AdminContext): Promise<ListMiseUsersResponse> {
  const dynamoClient = c.get('dynamoClient');
  const keys = await scanAllItemKeys(dynamoClient.client);

  const users = new Map<string, { userId: string; recipeCount: number; hasMealPlan: boolean }>();
  for (const { userId, item } of keys) {
    const user = users.get(userId) ?? { userId, recipeCount: 0, hasMealPlan: false };
    if (item.startsWith('R-')) {
      user.recipeCount++;
    } else if (item === 'MP') {
      user.hasMealPlan = true;
    }
    users.set(userId, user);
  }

  return {
    users: Array.from(users.values()).sort(
      (a, b) => b.recipeCount - a.recipeCount || a.userId.localeCompare(b.userId)
    ),
  };
}
