import { z } from 'zod';
import { ContextWithUserId } from '@core/types/context.js';
import { deleteOpenAIKeyForUser } from '@core/dynamodb/utilities.js';

export const DeleteOpenAIKeyResponseSchema = z.object({
  success: z.boolean(),
});

export type DeleteOpenAIKeyResponse = z.infer<typeof DeleteOpenAIKeyResponseSchema>;

export async function deleteOpenAIKey(c: ContextWithUserId): Promise<DeleteOpenAIKeyResponse> {
  const userId = c.get('userId');
  const dynamoClient = c.get('dynamoClient');

  await deleteOpenAIKeyForUser(dynamoClient.client, userId);

  return { success: true };
}
