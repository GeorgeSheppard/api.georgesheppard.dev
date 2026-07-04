import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { getShoppingListForUser } from '@core/dynamodb/utilities.js';
import { ShoppingListResponseSchema } from '../get-shopping-list/get-shopping-list.js';

export const GetActiveShoppingListResponseSchema = z.object({
  items: ShoppingListResponseSchema,
  generatedAt: z
    .number()
    .nullable()
    .describe('Unix timestamp (milliseconds) the list was generated at, null if none exists yet'),
});

export type GetActiveShoppingListResponse = z.infer<typeof GetActiveShoppingListResponseSchema>;

export async function getActiveShoppingList(
  c: ContextWithUserId
): Promise<GetActiveShoppingListResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  const stored = await getShoppingListForUser(dynamoClient.client, userId);

  if (!stored) {
    return { items: [], generatedAt: null };
  }

  return stored;
}
