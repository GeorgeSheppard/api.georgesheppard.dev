import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { putShoppingListForUser } from '@core/dynamodb/utilities.js';
import {
  getShoppingList,
  ShoppingListResponseSchema,
} from '../get-shopping-list/get-shopping-list.js';

export const GenerateShoppingListRequestSchema = z.object({
  dates: z.array(z.number()).optional().describe('Array of Unix timestamps (milliseconds)'),
});

export const GenerateShoppingListResponseSchema = z.object({
  items: ShoppingListResponseSchema,
  generatedAt: z.number().describe('Unix timestamp (milliseconds) the list was generated at'),
});

export type GenerateShoppingListRequest = z.infer<typeof GenerateShoppingListRequestSchema>;

export type GenerateShoppingListResponse = z.infer<typeof GenerateShoppingListResponseSchema>;

export async function generateShoppingList(
  c: ContextWithUserId,
  input?: GenerateShoppingListRequest
): Promise<GenerateShoppingListResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  const items = await getShoppingList(c, input);
  const generatedAt = Date.now();

  await putShoppingListForUser(dynamoClient.client, userId, { items, generatedAt });

  return { items, generatedAt };
}
